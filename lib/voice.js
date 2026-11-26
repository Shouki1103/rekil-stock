/* ReKiL 共通：音声入力。文字を入れる欄を選ぶと右下に🎤が出て、しゃべった言葉をその欄に入れる */
(function(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if(!SR || window.__rekilVoice) return; window.__rekilVoice = true;
  let target = null, rec = null, on = false;
  const btn = document.createElement("button"); btn.type = "button"; btn.textContent = "🎤"; btn.setAttribute("aria-label","音声入力");
  btn.style.cssText = "position:fixed;right:12px;bottom:calc(136px + env(safe-area-inset-bottom,0px));z-index:96;width:52px;height:52px;border-radius:26px;border:0;background:#f2a541;color:#14181d;font-size:24px;box-shadow:0 4px 16px #0008;display:none";
  const ok = el => el && ((el.tagName==="TEXTAREA") || (el.tagName==="INPUT" && /^(text|search|)$/.test(el.type||"")) ) && !el.readOnly && !el.disabled;
  /* 数字・単位の言い方をそろえる（採寸向け） */
  const fix = s => String(s).normalize("NFKC").replace(/センチ(メートル)?/g,"cm").replace(/ミリ(メートル)?/g,"mm").replace(/(\d)\s*てん\s*(\d)/g,"$1.$2").replace(/(\d)\s*点\s*(\d)/g,"$1.$2").replace(/\s+(?=\d)/g," ");
  function insert(text){ if(!target) return; const el = target, s = el.selectionStart ?? el.value.length, e = el.selectionEnd ?? el.value.length, v = el.value;
    const sep = s>0 && !/[\s\n]$/.test(v.slice(0,s)) && el.tagName==="TEXTAREA" ? "" : "";
    el.value = v.slice(0,s) + sep + text + v.slice(e); const p = s + sep.length + text.length; try{ el.setSelectionRange(p,p); }catch(_){}
    el.dispatchEvent(new Event("input", {bubbles:true})); el.dispatchEvent(new Event("change", {bubbles:true})); }
  function stop(){ on = false; btn.textContent = "🎤"; btn.style.background = "#f2a541"; try{ rec && rec.stop(); }catch(_){} }
  btn.addEventListener("pointerdown", e => e.preventDefault()); /* 入力欄のフォーカスを外さない */
  btn.onclick = () => { if(on){ stop(); return; } if(!target) return;
    rec = new SR(); rec.lang = "ja-JP"; rec.interimResults = false; rec.continuous = false;
    rec.onresult = ev => { const t = [...ev.results].map(r=>r[0].transcript).join(""); insert(fix(t)); };
    rec.onend = stop; rec.onerror = stop;
    try{ rec.start(); on = true; btn.textContent = "■"; btn.style.background = "#ff5d4d"; }catch(_){ stop(); } };
  document.addEventListener("focusin", e => { if(ok(e.target)){ target = e.target; btn.style.display = "block"; } });
  document.addEventListener("focusout", () => setTimeout(()=>{ if(!ok(document.activeElement) && !on) btn.style.display = "none"; }, 200));
  const add = () => document.body.appendChild(btn); if(document.body) add(); else document.addEventListener("DOMContentLoaded", add);
})();
