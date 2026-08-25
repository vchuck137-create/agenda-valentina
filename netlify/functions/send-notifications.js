const { schedule } = require('@netlify/functions');
const webpush = require('web-push');
const { getStore } = require('@netlify/blobs');

webpush.setVapidDetails(
  'mailto:agenda-valentina@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Manda el push a un dispositivo. Devuelve 'expired' si esa suscripción ya no
// sirve (el usuario desinstaló la app o revocó el permiso), para poder limpiarla.
async function sendPush(subscription, title, body) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify({ title, body }));
    return true;
  } catch (e) {
    console.error('Error enviando push:', e.message);
    if (e.statusCode === 404 || e.statusCode === 410) return 'expired';
    return false;
  }
}

const runner = async () => {
  const store = getStore({
    name: 'agenda-valentina',
    siteID: process.env.BLOBS_SITE_ID,
    token: process.env.BLOBS_TOKEN
  });

  let subscriptions = await store.get('push-subscriptions', { type: 'json' });
  if (!subscriptions) {
    // compatibilidad con la versión anterior de una sola suscripción
    const legacy = await store.get('push-subscription', { type: 'json' });
    subscriptions = legacy ? [legacy] : [];
  }
  const synced = await store.get('events-sync', { type: 'json' });
  const sentList = (await store.get('sent-notifications', { type: 'json' })) || [];
  const sent = new Set(sentList);

  if (!subscriptions.length || !synced || !Array.isArray(synced.events)) {
    return { statusCode: 200, body: 'nada que revisar' };
  }

  const now = new Date();
  let changed = false;
  let subsChanged = false;

  for (const ev of synced.events) {
    if (!ev.key || !ev.hora) continue;
    const start = new Date(`${ev.key}T${ev.hora}:00`);
    const fiveBefore = new Date(start.getTime() - 5 * 60000);
    const timeLabel = ev.hora + (ev.horaFin ? '–' + ev.horaFin : '');

    const idFive = ev.id + ':5min';
    const idStart = ev.id + ':start';

    if (!sent.has(idFive) && now >= fiveBefore && now < start) {
      for (const sub of subscriptions) {
        const result = await sendPush(sub, `En 5 minutos: ${ev.nombre}`, timeLabel);
        if (result === 'expired') {
          subscriptions = subscriptions.filter(s => s.endpoint !== sub.endpoint);
          subsChanged = true;
        }
      }
      sent.add(idFive);
      changed = true;
    }
    if (!sent.has(idStart) && now >= start && now.getTime() - start.getTime() < 3 * 60000) {
      for (const sub of subscriptions) {
        const result = await sendPush(sub, `Ahora: ${ev.nombre}`, timeLabel);
        if (result === 'expired') {
          subscriptions = subscriptions.filter(s => s.endpoint !== sub.endpoint);
          subsChanged = true;
        }
      }
      sent.add(idStart);
      changed = true;
    }
  }

  // Limpia marcas de más de 2 días para que esto no crezca sin límite.
  const cutoff = now.getTime() - 2 * 24 * 60 * 60 * 1000;
  const trimmed = [...sent].filter((id) => {
    const evId = id.split(':')[0];
    const ev = synced.events.find((e) => e.id === evId);
    if (!ev) return false;
    return new Date(`${ev.key}T${ev.hora}:00`).getTime() > cutoff;
  });

  if (changed || trimmed.length !== sentList.length) {
    await store.set('sent-notifications', JSON.stringify(trimmed));
  }
  if (subsChanged) {
    await store.set('push-subscriptions', JSON.stringify(subscriptions));
  }

  return { statusCode: 200, body: 'ok' };
};

module.exports.handler = schedule('* * * * *', runner);
