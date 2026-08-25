const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const store = getStore({
    name: 'agenda-valentina-data',
    siteID: process.env.BLOBS_SITE_ID,
    token: process.env.BLOBS_TOKEN
  });

  try{
    if(event.httpMethod === 'GET'){
      const params = event.queryStringParameters || {};

      if(params.prefix !== undefined){
        const { blobs } = await store.list({ prefix: params.prefix });
        return {
          statusCode: 200,
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ keys: blobs.map(b => b.key) })
        };
      }

      if(!params.key){
        return { statusCode: 400, body: JSON.stringify({ error: 'falta key' }) };
      }
      const value = await store.get(params.key);
      return {
        statusCode: 200,
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ value: value === null || value === undefined ? null : value })
      };
    }

    if(event.httpMethod === 'POST'){
      const { key, value } = JSON.parse(event.body || '{}');
      if(!key){
        return { statusCode: 400, body: JSON.stringify({ error: 'falta key' }) };
      }
      await store.set(key, value);
      return {
        statusCode: 200,
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ ok: true })
      };
    }

    return { statusCode: 405, body: 'Method not allowed' };
  }catch(e){
    return {
      statusCode: 500,
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ error: e.message })
    };
  }
};
