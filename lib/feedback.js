/* ReKiL 共通：「Claudeに直してほしい」ボタン。画面のスクショと直してほしい内容を、Claudeアプリなどへ送る */
(function(){
  /* 2026-11-27：代表の希望で一旦停止中。再開するときは下の return の行を消す */
  return;
  if(window.__rekilFb) return; window.__rekilFb = true;
  const css = "position:fixed;left:12px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:70;width:44px;height:44px;border-radius:22px;border:0;background:#2a313a;color:#f2a541;font:800 13px system-ui;box-shadow:0 4px 16px #0008;opacity:.85";
  const b = document.createElement("button"); b.type = "button"; b.textContent = "直す"; b.setAttribute("aria-label","Claudeに修正を依頼"); b.style.cssText = css;
  const name = () => (document.title || "").trim() || location.pathname;
  function loadScript(src){ return new Promise((ok,ng)=>{ const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = ng; document.head.appendChild(s); }); }
  async function shot(){
    try{ if(!window.html2canvas) await loadScript("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js");
      const main = document.querySelector("main") || document.body;
      const c = await html2canvas(document.body, {backgroundColor:"#14181d", scale: Math.min(2, window.devicePixelRatio||1), width: innerWidth, height: innerHeight, x: scrollX, y: scrollY, windowWidth: innerWidth, windowHeight: innerHeight, ignoreElements: el => el===b || el.id==="rekil-fb"});
      return await new Promise(ok=>c.toBlob(ok, "image/jpeg", .85)); }catch(_){ return null; } }
  function open(blob){
    const wrap = document.createElement("div"); wrap.id = "rekil-fb";
    wrap.style.cssText = "position:fixed;inset:0;z-index:99;background:#000b;display:flex;align-items:flex-end;justify-content:center;font-family:system-ui,sans-serif";
    const url = blob ? URL.createObjectURL(blob) : "";
    wrap.innerHTML = `<div style="background:#1d232a;color:#e8ebee;border-radius:18px 18px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));width:min(640px,100%);max-height:92%;overflow:auto">
      <div style="font-weight:800;font-size:16px;margin-bottom:8px">Claudeに直してほしいこと</div>
      ${url?`<img src="${url}" style="width:100%;max-height:220px;object-fit:contain;border-radius:8px;border:1px solid #2f3740">`:`<div style="font-size:12px;color:#9aa4af">（スクショは撮れませんでした。送るときに自分のスクショを付けてください）</div>`}
      <textarea id="fbT" rows="4" placeholder="例：このボタンが押せない／ここに○○の項目を足して" style="width:100%;box-sizing:border-box;margin-top:8px;font:inherit;font-size:16px;border-radius:10px;border:1px solid #2f3740;background:#14181d;color:#e8ebee;padding:8px 10px"></textarea>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button id="fbS" style="flex:1;min-height:44px;border-radius:10px;border:0;background:#f2a541;color:#14181d;font-weight:800;font-size:15px">送る（共有）</button>
        <button id="fbC" style="min-height:44px;border-radius:10px;border:1px solid #2f3740;background:#1d232a;color:#e8ebee;font-size:15px;padding:0 14px">閉じる</button></div>
      <div style="font-size:12px;color:#9aa4af;margin-top:8px">「送る」で共有画面が開きます。Claudeアプリを選んで送ってください（PCでは文章がコピーされ、スクショが保存されます。Claudeのチャットに貼ってください）。</div></div>`;
    document.body.appendChild(wrap);
    const close = () => { wrap.remove(); if(url) URL.revokeObjectURL(url); };
    wrap.querySelector("#fbC").onclick = close; wrap.onclick = e => { if(e.target===wrap) close(); };
    wrap.querySelector("#fbS").onclick = async () => {
      const ver = (document.documentElement.innerHTML.match(/const APP_VERSION = "([^"]+)"/)||[])[1] || "";
      const text = `【アプリ修正依頼】${name()}\n${wrap.querySelector("#fbT").value.trim() || "（内容はスクショを見てください）"}\n\n画面：${location.href}\n版：${ver}\n端末：${navigator.userAgent.match(/\(([^)]+)\)/)?.[1]||""}`;
      const file = blob ? new File([blob], "screenshot.jpg", {type:"image/jpeg"}) : null;
      try{ if(navigator.share && (!file || (navigator.canShare && navigator.canShare({files:[file]})))){ await navigator.share(file ? {text, files:[file]} : {text}); close(); return; } }catch(e){ if(e && e.name==="AbortError") return; }
      try{ await navigator.clipboard.writeText(text); }catch(_){}
      if(blob){ const a = document.createElement("a"); a.href = url; a.download = "修正依頼_スクショ.jpg"; a.click(); }
      alert("依頼文をコピーしました" + (blob ? "（スクショも保存しました）" : "") + "。Claudeのチャットに貼り付けて送ってください。"); close();
    };
    setTimeout(()=>wrap.querySelector("#fbT").focus(), 100);
  }
  b.onclick = async () => { b.textContent = "…"; const blob = await shot(); b.textContent = "直す"; open(blob); };
  const add = () => document.body.appendChild(b); if(document.body) add(); else document.addEventListener("DOMContentLoaded", add);
})();
