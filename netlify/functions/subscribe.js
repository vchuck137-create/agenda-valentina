const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  try {
    const subscription = JSON.parse(event.body);
    const store = getStore({
      name: 'agenda-valentina',
      siteID: process.env.BLOBS_SITE_ID,
      token: process.env.BLOBS_TOKEN
    });
    const existing = (await store.get('push-subscriptions', { type: 'json' })) || [];
    const withoutDuplicate = existing.filter(s => s.endpoint !== subscription.endpoint);
    withoutDuplicate.push(subscription);
    await store.set('push-subscriptions', JSON.stringify(withoutDuplicate));
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, dispositivos: withoutDuplicate.length })
    };
  } catch (e) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: e.message })
    };
  }
};
