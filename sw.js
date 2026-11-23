/* Vibra service worker 3.6 — repo scope /Vibra/; stale installs are replaced. */
const CACHE='vibra-shell-3-6';
const PREFIX='vibra-shell-';
const ROOT=new URL('./',self.location.href);
const CORE=['./','./index.html','./manifest.json','./pwa.js','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(async cache=>{
    // A missing optional file must never prevent SW activation or future updates.
    await Promise.allSettled(CORE.map(url=>cache.add(new Request(new URL(url,ROOT),{cache:'reload'}))));
    return self.skipWaiting();
  }));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==location.origin||!url.pathname.startsWith(ROOT.pathname))return;
  if(url.pathname.endsWith('/config.js') || url.pathname.includes('/auth/') || url.pathname.includes('/api/'))return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(res=>{
      if(res.ok && url.pathname===ROOT.pathname){const copy=res.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(new URL('./index.html',ROOT),copy)));}
      return res;
    }).catch(async()=>(await caches.match(new URL('./index.html',ROOT)))||Response.error()));
    return;
  }
  event.respondWith(fetch(req).then(res=>{
    if(res.ok && (url.pathname.match(/\.(?:js|css|png|svg|json|webmanifest|html)$/))) {
      const copy=res.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)));
    }
    return res;
  }).catch(async()=>(await caches.match(req))||Response.error()));
});
