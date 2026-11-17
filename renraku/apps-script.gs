/**
 * ReKiL 連絡（作業依頼ボード＋申し送り帳）用 Apps Script
 * 1. https://script.google.com で「新しいプロジェクト」→ このコードを全部貼り付けて保存
 * 2. 歯車「プロジェクトの設定」→「スクリプト プロパティ」に
 *      PASSCODE   = 社内の暗証番号（ReKiL Stockなどと同じ番号）
 *      LINE_TOKEN = LINEのチャネルアクセストークン（LINEで通知するときだけ。後からでOK）
 * 3. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *      次のユーザーとして実行：自分 ／ アクセスできるユーザー：全員
 *    → 「ウェブアプリのURL」をチャットに送る
 * LINEのグループに公式アカウントを入れて、グループで何か1回送ると、そのグループが通知先として自動で登録されます。
 */
const SHEET_ID = "1-9cXihe9UWxdlBoZqMYHrrhmjNDb4p1eKdVq30i4hHs";
const T_COLS = ["id","title","assignee","due","memo","done","doneAt","createdBy","createdAt"];
const N_COLS = ["id","text","author","createdAt","to"];
const P = PropertiesService.getScriptProperties();

function doPost(e){
  let p = {}; try{ p = JSON.parse(e.postData.contents || "{}"); }catch(_){}
  // LINE からの通知（グループに招待・メッセージ）→ 通知先グループを登録
  if(p.events){ (p.events||[]).forEach(ev=>{ const s = ev.source||{}; if(s.type==="group" && s.groupId) P.setProperty("LINE_GROUP_ID", s.groupId); }); return out({ok:true}); }
  const pass = P.getProperty("PASSCODE");
  if(!pass) return out({ok:false, error:"passcode_not_set"});
  if(String(p.pass||"") !== String(pass)) return out({ok:false, error:"passcode"});
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try{
    const ss = SpreadsheetApp.openById(SHEET_ID), ts = ss.getSheetByName("依頼"), ns = ss.getSheetByName("申し送り");
    let result = null;
    if(p.action === "saveTask"){
      const r = p.item || {}; const row = T_COLS.map(k => String(r[k] ?? ""));
      const i = ids(ts).indexOf(row[0]);
      if(i >= 0){ ts.getRange(i+2,1,1,T_COLS.length).setValues([row]); }
      else { ts.appendRow(row); line(`【作業依頼】${r.assignee ? r.assignee+"さんへ" : "全員へ"}\n${r.title}${r.due ? "\n期限："+r.due : ""}${r.memo ? "\n"+r.memo : ""}\n（依頼：${r.createdBy||""}）`); }
    }else if(p.action === "doneTask"){
      const i = ids(ts).indexOf(String(p.id)); if(i >= 0){ ts.getRange(i+2,6,1,2).setValues([[p.done?"1":"", p.done?new Date().toISOString():""]]);
        if(p.done){ const r = ts.getRange(i+2,1,1,T_COLS.length).getValues()[0]; line(`【完了】${r[1]}（${p.by||r[2]||""}）`); } }
    }else if(p.action === "removeTask"){
      const i = ids(ts).indexOf(String(p.id)); if(i >= 0) ts.deleteRow(i+2);
    }else if(p.action === "addNote"){
      const r = p.item || {}; ns.appendRow(N_COLS.map(k => String(r[k] ?? "")));
      line(`【申し送り】${r.author||""}${r.to ? "→"+r.to : ""}\n${r.text}`);
    }else if(p.action === "removeNote"){
      const i = ids(ns).indexOf(String(p.id)); if(i >= 0) ns.deleteRow(i+2);
    }
    return out({ok:true, result, tasks: rows(ts, T_COLS), notes: rows(ns, N_COLS).slice(-300), line: !!(P.getProperty("LINE_TOKEN") && P.getProperty("LINE_GROUP_ID"))});
  }finally{ lock.releaseLock(); }
}
function ids(sh){ const n = sh.getLastRow()-1; return n>0 ? sh.getRange(2,1,n,1).getValues().map(r=>String(r[0])) : []; }
function rows(sh, cols){ const n = sh.getLastRow()-1; if(n<=0) return []; return sh.getRange(2,1,n,cols.length).getValues().map(r=>{ const o={}; cols.forEach((k,i)=>o[k]=r[i] instanceof Date ? r[i].toISOString() : String(r[i]??"")); return o; }); }
function line(text){
  const token = P.getProperty("LINE_TOKEN"), to = P.getProperty("LINE_GROUP_ID"); if(!token || !to) return;
  try{ UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {method:"post", contentType:"application/json", headers:{Authorization:"Bearer "+token}, payload: JSON.stringify({to, messages:[{type:"text", text: String(text).slice(0,4900)}]}), muteHttpExceptions:true}); }catch(_){}
}
function out(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
