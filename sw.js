self.addEventListener('push', (event) => {
  // Señal de diagnóstico: avisa al servidor que el push SÍ llegó al teléfono,
  // pase lo que pase después con showNotification. Esto nos deja confirmar
  // la entrega real revisando los logs de la función "log-push" en Netlify.
  event.waitUntil(
    fetch('/.netlify/functions/log-push', { method: 'POST' }).catch(() => {})
  );

  let data = { title: 'Agenda de Valentina', body: '' };
  try {
    data = event.data.json();
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Agenda de Valentina', {
      body: data.body || ''
    }).catch((err) => {
      fetch('/.netlify/functions/log-push', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ error: String(err) })
      }).catch(() => {});
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
