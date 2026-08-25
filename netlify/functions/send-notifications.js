const { schedule } = require('@netlify/functions');
const webpush = require('web-push');
const { getStore } = require('@netlify/blobs');

webpush.setVapidDetails(
  'mailto:agenda-valentina@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function sendPush(subscription, title, body) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify({ title, body }));
  } catch (e) {
    console.error('Error enviando push:', e.message);
  }
}

const runner = async () => {
  const store = getStore('agenda-valentina');

  const subscription = await store.get('push-subscription', { type: 'json' });
  const synced = await store.get('events-sync', { type: 'json' });
  const sentList = (await store.get('sent-notifications', { type: 'json' })) || [];
  const sent = new Set(sentList);

  if (!subscription || !synced || !Array.isArray(synced.events)) {
    return { statusCode: 200, body: 'nada que revisar' };
  }

  const now = new Date();
  let changed = false;

  for (const ev of synced.events) {
    if (!ev.key || !ev.hora) continue;
    const start = new Date(`${ev.key}T${ev.hora}:00`);
    const fiveBefore = new Date(start.getTime() - 5 * 60000);
    const timeLabel = ev.hora + (ev.horaFin ? '–' + ev.horaFin : '');

    const idFive = ev.id + ':5min';
    const idStart = ev.id + ':start';

    if (!sent.has(idFive) && now >= fiveBefore && now < start) {
      await sendPush(subscription, `En 5 minutos: ${ev.nombre}`, timeLabel);
      sent.add(idFive);
      changed = true;
    }
    if (!sent.has(idStart) && now >= start && now.getTime() - start.getTime() < 3 * 60000) {
      await sendPush(subscription, `Ahora: ${ev.nombre}`, timeLabel);
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

  return { statusCode: 200, body: 'ok' };
};

module.exports.handler = schedule('* * * * *', runner);
