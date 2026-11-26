/* ReKiL 共通：電波が悪くても入力できるようにする
   ・データ側（Apps Script）への保存が送れなかったら、この端末にためて、電波が戻ったら順番に送る
   ・読み込みが失敗したら、前回読み込んだデータを表示する */
(function(){
  if(window.__rekilOffline) return; window.__rekilOffline = true;
  const RO = /^(list|load|summary|history|get|search|photo)$/;
  const QK = "rekil-offline-queue", CK = "rekil-offline-cache:";
  const of = window.fetch.bind(window);
  const lsg = (k,d) => { try{ const v = localStorage.getItem(k); return v==null ? d : JSON.parse(v); }catch(_){ return d; } };
  const lss = (k,v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){} };
  const isGas = u => /script\.google(usercontent)?\.com\/macros\//.test(u);
  let bar = null;
  function badge(){ const q = lsg(QK, []); if(!document.body) return; if(!bar){ bar = document.createElement("div"); bar.style.cssText = "position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 6px);transform:translateX(-50%);z-index:95;background:#f2a541;color:#14181d;font:700 12px system-ui;padding:4px 12px;border-radius:12px;box-shadow:0 2px 10px #0006;display:none"; bar.onclick = flush; document.body.appendChild(bar); }
    bar.textContent = `送信待ち ${q.length}件（電波が戻ると自動で送ります）`; bar.style.display = q.length ? "block" : "none"; }
  const resp = obj => new Response(JSON.stringify(obj), {status:200, headers:{"Content-Type":"application/json"}});
  let flushing = false;
  async function flush(){ if(flushing) return; const q = lsg(QK, []); if(!q.length){ badge(); return; } flushing = true;
    try{ while(true){ const cur = lsg(QK, []); if(!cur.length) break; const x = cur[0];
        try{ const r = await of(x.url, {method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"}, body:x.body}); await r.text(); }catch(_){ break; }
        lss(QK, lsg(QK, []).slice(1)); badge(); } }
    finally{ flushing = false; badge(); } }
  window.fetch = async function(input, init){
    const url = typeof input === "string" ? input : input && input.url || "";
    if(!isGas(url) || !init || String(init.method||"GET").toUpperCase() !== "POST") return of(input, init);
    let body = init.body, act = ""; try{ act = JSON.parse(body).action || ""; }catch(_){}
    const read = RO.test(act), key = CK + url;
    if(!read && lsg(QK, []).length){ /* 先にたまっている分があれば順番を守るため後ろに並べる */ const q = lsg(QK, []); q.push({url, body, at:Date.now()}); lss(QK, q); badge(); flush(); const c = lsg(key, null); return resp(Object.assign({}, c||{}, {ok:true, queued:true})); }
    try{
      const r = await of(input, init);
      if(read && r.ok){ try{ const j = await r.clone().json(); if(j && j.ok){ const s = JSON.stringify(j); if(s.length < 1500000) lss(key, j); } }catch(_){} }
      return r;
    }catch(err){
      const c = lsg(key, null);
      if(read){ if(c) return resp(Object.assign({}, c, {offline:true})); throw err; }
      const q = lsg(QK, []); q.push({url, body, at:Date.now()}); lss(QK, q); badge();
      return resp(Object.assign({}, c||{}, {ok:true, queued:true}));
    }
  };
  addEventListener("online", flush);
  document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="visible") flush(); });
  setInterval(()=>{ if(navigator.onLine) flush(); }, 30000);
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", ()=>{ badge(); flush(); }); else { badge(); flush(); }
})();
