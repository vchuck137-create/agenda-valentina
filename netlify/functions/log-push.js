exports.handler = async (event) => {
  let info = '';
  try{
    if(event.body) info = event.body;
  }catch(e){}
  console.log('PUSH RECIBIDO EN EL TELÉFONO', info || '(sin detalle, mostrado ok)');
  return { statusCode: 200, body: 'ok' };
};
