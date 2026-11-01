// sw.js — recebe os avisos (push) mesmo com o app fechado. Não guarda nada em cache.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
    let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { titulo: 'Aviso', corpo: e.data ? e.data.text() : '' }; }
    e.waitUntil(self.registration.showNotification(d.titulo || 'Minhas Notas', { body: d.corpo || '', tag: d.tag || undefined, data: { url: d.url || './index.html' } }));
});
self.addEventListener('notificationclick', e => {
    e.notification.close();
    const url = new URL((e.notification.data && e.notification.data.url) || './index.html', self.registration.scope).href;
    e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => {
        const aberta = l.find(c => c.url.startsWith(self.registration.scope));
        if (aberta) { aberta.postMessage({ abrir: new URL(url).searchParams.get('abrir') || '' }); return aberta.focus(); }
        return self.clients.openWindow(url);
    }));
});
