/**
 * ReKiL 資金繰り（代表専用） 用 Apps Script
 * 1. スプレッドシート「ReKiL 資金繰り（代表専用）」を開く →「拡張機能」→「Apps Script」
 *    → 最初からあるコードを消して、このコードを全部貼り付けて保存
 * 2. 左の歯車「プロジェクトの設定」→「スクリプト プロパティ」に
 *      PASSCODE = （代表だけが知っている番号）
 *    を追加（コードには番号を書かない）
 * 3. 上の関数選択で「setupTrigger」を選んで「実行」→ 許可（毎日11時台のチェックメールが動きます）
 * 4. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *      次のユーザーとして実行：自分 ／ アクセスできるユーザー：全員
 *    → 表示された「ウェブアプリのURL」をチャットに送る
 * ※ 暗証番号がないとデータは一切返しません。
 */
const SHEET_ID = "1nskXPvlMvbpn91gVv0EUvlwtFXKsGPPAiAFgdoOAs-w";
const COLS = {
  "口座": ["id","name","cur","low","balance","updated","by","memo","order"],
  "予定": ["id","name","kind","acct","amount","freq","day","month","date","start","end","vary","shift","memo"],
  "月別": ["plan","ym","amount","done"],
};
const TZ = "Asia/Tokyo";
/* ===== 資金繰りの計算（アプリと Apps Script で同じもの） ===== */
const HOL = new Set(["2026-01-01","2026-01-12","2026-02-11","2026-02-23","2026-03-20","2026-04-29","2026-05-03","2026-05-04","2026-05-05","2026-05-06","2026-07-20","2026-08-11","2026-09-21","2026-09-22","2026-09-23","2026-10-12","2026-11-03","2026-11-23",
"2027-01-01","2027-01-11","2027-02-11","2027-02-23","2027-03-21","2027-03-22","2027-04-29","2027-05-03","2027-05-04","2027-05-05","2027-07-19","2027-08-11","2027-09-20","2027-09-23","2027-10-11","2027-11-03","2027-11-23",
"2028-01-01","2028-01-10","2028-02-11","2028-02-23","2028-03-20","2028-04-29","2028-05-03","2028-05-04","2028-05-05","2028-07-17","2028-08-11","2028-09-18","2028-09-22","2028-10-09","2028-11-03","2028-11-23"]);
const KINDS = ["融資返済","クレカ","税金・社保","固定費","給与","入金","その他"];
const D1 = 864e5;
function fYmd(d){ return new Date(d).toISOString().slice(0,10); }
function pD(s){ return new Date(String(s).slice(0,10)+"T00:00:00Z"); }
function lastDay(y,m){ return new Date(Date.UTC(y,m,0)).getUTCDate(); } /* m=1〜12 */
function isBiz(d){ const w=d.getUTCDay(); if(w===0||w===6) return false; const s=fYmd(d); if(HOL.has(s)) return false; const md=s.slice(5); return !["12-31","01-01","01-02","01-03"].includes(md); }
function shiftBiz(d, mode){ if(mode==="none") return d; const st = mode==="prev" ? -1 : 1; let x=d; let n=0; while(!isBiz(x) && n++<15) x=new Date(x.getTime()+st*D1); return x; }
function addYm(ym, k){ let y=+ym.slice(0,4), m=+ym.slice(5,7)+k; while(m>12){m-=12;y++;} while(m<1){m+=12;y--;} return y+"-"+String(m).padStart(2,"0"); }
function horizonOf(today, months){ const ym=addYm(today.slice(0,7), +months||1); return ym+"-"+String(lastDay(+ym.slice(0,4),+ym.slice(5,7))).padStart(2,"0"); }
/* 予定 → from〜to の発生日リスト */
function occurrences(plans, ovr, from, to){
  const out=[];
  (plans||[]).forEach(p=>{
    const push=(date, ym)=>{
      if(date<from || date>to) return;
      const o=(ovr||{})[p.id+"|"+ym]||{};
      const has = o.amount!==undefined && o.amount!=="" && o.amount!==null;
      const amt = Math.abs(+(has ? o.amount : p.amount) || 0);
      out.push({id:p.id+"|"+ym, plan:p.id, name:p.name, kind:p.kind, acct:p.acct, date, ym, amount:amt, sign: p.kind==="入金" ? 1 : -1,
        done: !!(+o.done), est: !!(+p.vary) && !has});
    };
    if(p.freq==="1回"){ if(p.date) push(String(p.date).slice(0,10), String(p.date).slice(0,7)); return; }
    let ym=addYm(from.slice(0,7),-1); const endYm=to.slice(0,7);
    for(let g=0; ym<=endYm && g<40; g++, ym=addYm(ym,1)){
      if(p.freq==="毎年" && +p.month!==+ym.slice(5,7)) continue;
      if(p.start && ym<p.start) continue; if(p.end && ym>p.end) continue;
      const y=+ym.slice(0,4), m=+ym.slice(5,7), L=lastDay(y,m);
      const day = (p.day==="末"||!p.day) ? L : Math.min(+p.day||1, L);
      push(fYmd(shiftBiz(new Date(Date.UTC(y,m-1,day)), p.shift||"next")), ym);
    }
  });
  return out.sort((a,b)=> a.date<b.date?-1:a.date>b.date?1: a.sign-b.sign);
}
/* 口座ごとに見込み残高を計算 */
function forecast(data, today){
  const st=data.settings||{}, to=horizonOf(today, st.months||1), stale=+st.staleDays||7;
  const accounts=(data.accounts||[]).map(a=>{
    const has = a.balance!=="" && a.balance!==null && a.balance!==undefined && !isNaN(+a.balance);
    const base = has && a.updated ? String(a.updated).slice(0,10) : "";
    const from = base || today;
    const ev = occurrences((data.plans||[]).filter(p=>p.acct===a.id), data.ovr, from, to).filter(e=>!e.done);
    let run = has ? +a.balance : 0, min = run, neg=null, lowHit=null; const lowv = +a.low||0;
    ev.forEach(e=>{ run += e.sign*e.amount; e.after = run; if(run<min) min=run;
      if(has && run<0 && !neg) neg={date:e.date, name:e.name, need:-run};
      if(has && run<lowv && !lowHit) lowHit={date:e.date, name:e.name, need:lowv-run}; });
    if(has && neg) neg.need = -min;  /* 期間中で一番足りない額 */
    if(has && lowHit) lowHit.need = lowv-min;
    const age = base ? Math.round((pD(today)-pD(base))/D1) : null;
    const status = !has ? "未入力" : neg ? "不足" : lowHit ? "注意" : "OK";
    return {...a, has, base, events:ev, end:run, min, neg, lowHit, age, stale: has && age>stale, status,
      out: ev.filter(e=>e.sign<0).reduce((s,e)=>s+e.amount,0), inn: ev.filter(e=>e.sign>0).reduce((s,e)=>s+e.amount,0),
      est: ev.filter(e=>e.est)};
  });
  return {to, accounts};
}
/* ホーム・メール用の要約 */
function alerts(fc, data){
  const yen=n=>Math.round(n).toLocaleString("ja-JP"), md=s=>(+s.slice(5,7))+"/"+(+s.slice(8,10));
  const cur=a=>a.cur==="USD"?"$":"", out=[];
  fc.accounts.forEach(a=>{
    if(a.status==="不足") out.push({lv:2, t:`${a.name}：${md(a.neg.date)}の「${a.neg.name}」で残高不足`, v:`${cur(a)}${yen(a.neg.need)}足りない`});
    else if(a.status==="注意") out.push({lv:1, t:`${a.name}：${md(a.lowHit.date)}以降、下限を下回る`, v:`下限まで${cur(a)}${yen(a.lowHit.need)}不足`});
    if(a.status==="未入力" && (data.plans||[]).some(p=>p.acct===a.id)) out.push({lv:1, t:`${a.name}：残高が未入力`, v:"入力して"});
    else if(a.stale) out.push({lv:1, t:`${a.name}：残高が${a.age}日前のまま`, v:"更新して"});
    a.est.forEach(e=>out.push({lv:0, t:`${md(e.date)} ${e.name}：${+e.ym.slice(5)}月分の金額が未入力（目安で計算中）`, v:`目安${yen(e.amount)}`}));
  });
  return out.sort((x,y)=>y.lv-x.lv);
}

/* ===== データの読み書き ===== */
function ss(){ return SpreadsheetApp.openById(SHEET_ID); }
function norm(v, k){
  if(v instanceof Date){ return Utilities.formatDate(v, TZ, (k==="updated") ? "yyyy-MM-dd HH:mm" : (k==="start"||k==="end"||k==="ym") ? "yyyy-MM" : "yyyy-MM-dd"); }
  return v===null||v===undefined ? "" : v;
}
function readSheet(name){
  const sh = ss().getSheetByName(name), cols = COLS[name], n = sh.getLastRow()-1; if(n<=0) return [];
  return sh.getRange(2,1,n,cols.length).getValues().filter(r=>String(r[0]).trim()).map(r=>{ const o={}; cols.forEach((k,i)=>o[k]=norm(r[i],k)); return o; });
}
function settings(){
  const sh = ss().getSheetByName("設定"), n = sh.getLastRow()-1, o = {}; if(n<=0) return o;
  sh.getRange(2,1,n,2).getValues().forEach(r=>{ if(r[0]) o[String(r[0])] = r[1]; }); return o;
}
function loadAll(){
  const ovr = {}; readSheet("月別").forEach(r=>{ ovr[r.plan+"|"+r.ym] = {amount: r.amount, done: r.done}; });
  const accounts = readSheet("口座").sort((a,b)=>(+a.order||99)-(+b.order||99));
  return {accounts, plans: readSheet("予定"), ovr, settings: settings()};
}
function upsert(name, item, keyFn){
  const sh = ss().getSheetByName(name), cols = COLS[name], n = sh.getLastRow()-1;
  const keys = n>0 ? sh.getRange(2,1,n,cols.length).getValues().map(r=>keyFn(r)) : [];
  const row = cols.map(k=>item[k]===undefined ? "" : item[k]);
  const i = keys.indexOf(keyFn(row));
  if(i>=0) sh.getRange(i+2,1,1,cols.length).setValues([row]); else sh.appendRow(row);
}
function removeRow(name, id){
  const sh = ss().getSheetByName(name), n = sh.getLastRow()-1; if(n<=0) return;
  const ids = sh.getRange(2,1,n,1).getValues().map(r=>String(r[0])); const i = ids.indexOf(String(id)); if(i>=0) sh.deleteRow(i+2);
}
function nowStr(){ return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm"); }
function todayStr(){ return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd"); }

function doPost(e){
  let p = {}; try{ p = JSON.parse(e.postData.contents || "{}"); }catch(_){}
  const pass = PropertiesService.getScriptProperties().getProperty("PASSCODE");
  if(!pass) return out({ok:false, error:"passcode_not_set"});
  if(String(p.pass||"") !== String(pass)) return out({ok:false, error:"passcode"});
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try{
    const a = p.action || "list";
    if(a === "summary"){ const d = loadAll(); return out({ok:true, alerts: alerts(forecast(d, todayStr()), d)}); }
    if(a === "setBalance"){
      const acc = readSheet("口座").find(x=>x.id===p.id); if(!acc) return out({ok:false, error:"noaccount"});
      acc.balance = +p.balance; acc.updated = nowStr(); acc.by = p.by || "手入力";
      upsert("口座", acc, r=>String(r[0]));
      ss().getSheetByName("残高履歴").appendRow([acc.updated, acc.id, acc.name, acc.balance, acc.by]);
    }
    else if(a === "saveAccount") upsert("口座", p.item||{}, r=>String(r[0]));
    else if(a === "removeAccount") removeRow("口座", p.id);
    else if(a === "savePlan") upsert("予定", p.item||{}, r=>String(r[0]));
    else if(a === "removePlan") removeRow("予定", p.id);
    else if(a === "setOvr") upsert("月別", {plan:p.plan, ym:"'"+p.ym, amount:p.amount, done:p.done?1:""}, r=>String(r[0])+"|"+String(norm(r[1],"ym")).replace(/^'/,""));
    else if(a === "saveSettings"){
      const sh = ss().getSheetByName("設定"), n = sh.getLastRow()-1, rows = n>0 ? sh.getRange(2,1,n,1).getValues().map(r=>String(r[0])) : [];
      Object.keys(p.settings||{}).forEach(k=>{ const i = rows.indexOf(k); if(i>=0) sh.getRange(i+2,2).setValue(p.settings[k]); else sh.appendRow([k, p.settings[k], ""]); });
    }
    return out({ok:true, data: loadAll(), now: nowStr()});
  }finally{ lock.releaseLock(); }
}
function out(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ===== 毎日のチェックメール（問題があるときだけ送る） ===== */
function dailyCheck(){
  const d = loadAll(), t = todayStr(), fc = forecast(d, t), al = alerts(fc, d);
  const soon = fYmd(pD(t).getTime()+7*D1);
  const est7 = fc.accounts.some(a=>a.est.some(e=>e.date<=soon));
  if(!al.some(x=>x.lv>=1) && !est7) return;  /* 不足・注意・残高の更新忘れ、または7日以内の金額未入力があるときだけ送る */
  const yen = n=>Math.round(n).toLocaleString("ja-JP"), md = s=>(+s.slice(5,7))+"/"+(+s.slice(8,10));
  const bad = fc.accounts.filter(a=>a.status==="不足"), warn = fc.accounts.filter(a=>a.status==="注意");
  const subj = bad.length ? `【資金繰り】残高不足の見込み（${bad.map(a=>a.name).join("・")}）`
             : warn.length ? `【資金繰り】下限を下回る見込み（${warn.map(a=>a.name).join("・")}）`
             : `【資金繰り】確認してほしいことがあります`;
  let body = `${fc.to.slice(0,7).replace("-","年")}月末までの見込みです（${t} 時点）。\n\n■ お知らせ\n` + al.map(x=>`・${x.t}（${x.v}）`).join("\n") + "\n\n■ 口座ごとの見込み\n";
  fc.accounts.forEach(a=>{ const c = a.cur==="USD" ? "$" : "";
    body += `\n【${a.name}】${a.status}\n  今の残高：${a.has ? c+yen(a.balance)+"（"+a.base+"時点）" : "未入力"}\n  出金予定：${c}${yen(a.out)} ／ 入金予定：${c}${yen(a.inn)}\n  ${md(fc.to)}の見込み：${c}${yen(a.end)}（一番少ない時：${c}${yen(a.min)}）\n`;
    a.events.slice(0,12).forEach(e=>{ body += `   ${md(e.date)} ${e.sign<0?"−":"＋"}${c}${yen(e.amount)} ${e.name}${e.est?"（目安）":""} → ${c}${yen(e.after)}\n`; }); });
  body += `\nアプリ：https://shouki1103.github.io/rekil-stock/shikin/\n`;
  MailApp.sendEmail(String(d.settings.mail || "rekil.usedclothing@gmail.com"), subj, body);
}
function setupTrigger(){
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==="dailyCheck").forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("dailyCheck").timeBased().atHour(11).everyDays(1).inTimezone(TZ).create();
  dailyCheck();
}
