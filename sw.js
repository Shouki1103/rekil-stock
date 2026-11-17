/* ReKiL アプリ共通：電波がなくても開けるように、最後に開いた画面を保存しておく（データの送受信は対象外） */
const C = "rekil-shell-v1";
self.addEventListener("install", e => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if(r.method !== "GET" || u.origin !== location.origin) return; // Apps Script などへの通信はそのまま
  e.respondWith(fetch(r).then(res => { if(res.ok){ const cp = res.clone(); caches.open(C).then(c => c.put(r, cp)); } return res; })
    .catch(() => caches.match(r, {ignoreSearch: true}).then(m => m || caches.match(new URL("./", r.url).href, {ignoreSearch:true}))));
});
