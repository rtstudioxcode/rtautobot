// src/lib/swShield.js
function jsString(value) { return JSON.stringify(String(value)); }
export function buildProtectedServiceWorker(version) {
  const v = jsString(version || "v1");
  return `(()=>{const V=${v},N="rtsmm-cache-"+V;self.addEventListener("install",e=>{self.skipWaiting()});self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(a=>Promise.all(a.filter(k=>k.startsWith("rtsmm-cache-")&&k!==N).map(k=>caches.delete(k)))));self.clients.claim()});const C=r=>{const u=r.url;if(r.method!=="GET")return false;if(!u.startsWith(self.location.origin))return false;if(u.includes("/api/pricing"))return false;return u.includes("/api/service-groups")||u.includes("/api/subcategories")||u.includes("/api/platforms")};self.addEventListener("fetch",e=>{const r=e.request;if(!C(r))return;e.respondWith((async()=>{const c=await caches.open(N),m=await c.match(r);if(m)return m;try{const s=await fetch(r);if(s&&s.ok)c.put(r,s.clone());return s}catch{return new Response(JSON.stringify({ok:false,offline:true}),{status:503,headers:{"Content-Type":"application/json"}})}})())});})();`;
}
