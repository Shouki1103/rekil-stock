/**
 * ReKiL アカウント・サイト一覧 用 Apps Script
 * 1. https://script.google.com で「新しいプロジェクト」→ このコードを全部貼り付けて保存
 * 2. 左の歯車「プロジェクトの設定」→「スクリプト プロパティ」に
 *      PASSCODE = （自分だけが知っている番号）
 *    を追加（コードには番号を書かない）
 * 3. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *      次のユーザーとして実行：自分 ／ アクセスできるユーザー：全員
 *    → 表示された「ウェブアプリのURL」をチャットに送る
 * ※ パスワードは保存しない設計です。
 */
const SHEET_ID = "11Os5NS2Sq_CbMjkDd6S6HPY9XHBF1wRpvZ5s4-9aMIk";
const SHEET_NAME = "一覧";
const COLS = ["cat","name","url","member","email","person","tel","pmail","memo","id"]; // A〜J

function doPost(e){
  let p = {}; try{ p = JSON.parse(e.postData.contents || "{}"); }catch(_){}
  const pass = PropertiesService.getScriptProperties().getProperty("PASSCODE");
  if(!pass) return out({ok:false, error:"passcode_not_set"});
  if(String(p.pass||"") !== String(pass)) return out({ok:false, error:"passcode"});
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try{
    const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    let result = null;
    if(p.action === "save"){
      const r = p.item || {};
      const row = COLS.map(k => k==="id" ? (r.id || ("a" + Date.now().toString(36))) : String(r[k] ?? ""));
      const ids = idCol(sh); const i = ids.indexOf(row[9]);
      if(i >= 0) sh.getRange(i+2, 1, 1, COLS.length).setValues([row]); else sh.appendRow(row);
      result = row[9];
    }else if(p.action === "remove"){
      const ids = idCol(sh); const i = ids.indexOf(String(p.id||"")); if(i >= 0) sh.deleteRow(i+2);
    }
    return out({ok:true, result, items: list(sh)});
  }finally{ lock.releaseLock(); }
}
function idCol(sh){ const n = sh.getLastRow()-1; return n>0 ? sh.getRange(2, 10, n, 1).getValues().map(r=>String(r[0])) : []; }
function list(sh){
  const n = sh.getLastRow()-1; if(n<=0) return [];
  return sh.getRange(2, 1, n, COLS.length).getValues().filter(r=>r[1]||r[9]).map(r=>{ const o={}; COLS.forEach((k,i)=>o[k]=String(r[i]??"")); return o; });
}
function out(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
