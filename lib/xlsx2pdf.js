/* 出品リストのExcel（xlsx・xls・csv）をPDFにして保存する（変換はデータ側のApps Scriptで行う） */
(function(){
  /* ▼ 「ReKiL 出品リスト変換」をデプロイしたときの「ウェブアプリのURL」 */
  const URL_ = "https://script.google.com/macros/s/AKfycbz8eJ3PeQ8erSYsY09yCBnrr8oS74ekMOnX1V-lEfiKFggVa7pPqmcnsUsfmQyokK9O/exec";
  window.XLSX2PDF_READY = !!URL_;
  window.isExcel = f => f && /\.(xlsx|xlsm|xls|csv)$/i.test(f.name || "");
  function b64(file){
    return new Promise((ok, ng) => { const r = new FileReader();
      r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = () => ng(new Error("read")); r.readAsDataURL(file); });
  }
  /* 戻り値：保存したPDFのDriveファイルID */
  window.excelToPdf = async function(file, pass){
    if(!URL_){ const e = new Error("no_converter"); e.code = "no_converter"; throw e; }
    const data = await b64(file);
    let res;
    try{ res = await fetch(URL_, {method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"}, body: JSON.stringify({action:"xlsx2pdf", pass, name: file.name, data})}); }
    catch(_){ const e = new Error("network"); e.code = "network"; throw e; }
    let j; try{ j = await res.json(); }catch(_){ const e = new Error("bad_response"); e.code = "bad_response"; throw e; }
    if(!j.ok){ const e = new Error(j.error || "error"); e.code = j.error || "error"; throw e; }
    return j.result.id;
  };
})();
