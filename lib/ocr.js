/* 写真の文字読み取り（必要なときだけ読み込む）＋レシート・値札・精算書の項目抜き出し */
(function(){
  let worker = null, loading = null;
  function loadScript(src){ return new Promise((ok,ng)=>{ const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = ng; document.head.appendChild(s); }); }
  async function getWorker(onProgress){
    if(worker) return worker;
    if(!loading) loading = (async()=>{
      if(!window.Tesseract) await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
      worker = await Tesseract.createWorker(["jpn","eng"], 1, {logger: m => onProgress && m.status==="recognizing text" && onProgress(Math.round(m.progress*100))});
      return worker;
    })();
    return loading;
  }
  /* 画像を縮めてから読む（速く・軽く） */
  async function shrink(file, max){
    const img = await new Promise((ok,ng)=>{ const i = new Image(); i.onload = ()=>ok(i); i.onerror = ng; i.src = URL.createObjectURL(file); });
    const r = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
    c.width = Math.round(img.width*r); c.height = Math.round(img.height*r); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c;
  }
  const z2h = s => String(s||"").normalize("NFKC");
  async function read(file, onProgress){ const w = await getWorker(onProgress); const c = await shrink(file, 1600); const r = await w.recognize(c); return z2h(r.data.text); }
  function receipt(t){
    const lines = t.split(/\n/).map(s=>s.trim()).filter(Boolean);
    let date = "", m = t.match(/(20\d{2}|R?\d{1,2})\s*[年\/\.\-]\s*(\d{1,2})\s*[月\/\.\-]\s*(\d{1,2})/);
    if(m){ let y = +m[1].replace("R",""); if(y<100) y = y<50 ? 2018+y : 1900+y; date = `${y}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`; }
    let total = 0; const tl = lines.find(l=>/(合\s*計|お買上|総額|ご請求)/.test(l) && /\d/.test(l));
    const num = s => +(String(s).replace(/[^\d]/g,"")||0);
    if(tl){ const ns = tl.match(/[\d,]{2,}/g); if(ns) total = num(ns[ns.length-1]); }
    if(!total){ const all = (t.match(/[¥\\]\s*[\d,]{2,}/g)||[]).map(num); if(all.length) total = Math.max(...all); }
    const tno = (t.replace(/\s/g,"").match(/T\d{13}/)||[""])[0];
    const store = lines.find(l=>!/^\d|領収|レシート|電話|TEL|〒|http/i.test(l) && l.length>=2) || "";
    const rate8 = /軽減|8\s*%|※/.test(t) && !/10\s*%/.test(t);
    return {date, total, tno, store, rate: rate8 ? 8 : 10};
  }
  function prices(t){ return [...new Set((t.match(/(?:[¥\\]\s*[\d,]{3,}|[\d,]{3,}\s*円)/g)||[]).map(s=>+s.replace(/[^\d]/g,"")))].filter(n=>n>=100); }
  function brands(t, list){ const u = t.toUpperCase().replace(/\s/g,""); return list.filter(b=>u.includes(b.toUpperCase().replace(/\s/g,""))); }
  function count(t){ const m = t.match(/(\d+)\s*(点|個|件)/); return m ? +m[1] : 0; }
  window.RekilOCR = {read, receipt, prices, brands, count, shrink};
})();
