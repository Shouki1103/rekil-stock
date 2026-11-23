/* PDFの各ページをJPEG画像（base64）にする。PDFを選んだときだけ pdf.js を読み込む（ふだんのアプリは軽いまま） */
(function(){
  const V = "3.11.174", BASE = "https://cdn.jsdelivr.net/npm/pdfjs-dist@" + V + "/build/";
  let loading = null;
  function load(){
    if(window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if(loading) return loading;
    loading = new Promise((ok, ng) => {
      const s = document.createElement("script");
      s.src = BASE + "pdf.min.js";
      s.onload = () => { try{ window.pdfjsLib.GlobalWorkerOptions.workerSrc = BASE + "pdf.worker.min.js"; ok(window.pdfjsLib); }catch(e){ ng(e); } };
      s.onerror = () => { loading = null; ng(new Error("pdf_load")); };
      document.head.appendChild(s);
    });
    return loading;
  }
  /* file: PDFファイル、max: 長い辺の最大ピクセル、onPage(i, n): 進み具合 */
  window.pdfToJpegs = async function(file, max, onPage){
    const lib = await load();
    const pdf = await lib.getDocument({data: await file.arrayBuffer()}).promise;
    const out = [], n = Math.min(pdf.numPages, 30);
    for(let i = 1; i <= n; i++){
      if(onPage) onPage(i, n);
      const page = await pdf.getPage(i);
      const v1 = page.getViewport({scale: 1});
      const scale = Math.min(3, max / Math.max(v1.width, v1.height));
      const vp = page.getViewport({scale});
      const c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
      await page.render({canvasContext: g, viewport: vp}).promise;
      out.push(c.toDataURL("image/jpeg", .85).split(",")[1]);
      page.cleanup();
    }
    pdf.destroy();
    return out;
  };
  window.isPdf = f => f && (f.type === "application/pdf" || /\.pdf$/i.test(f.name || ""));
})();
