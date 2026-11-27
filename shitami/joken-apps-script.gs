/**
 * ReKiL 下見・指値 進捗 ―「下見条件」「下見依頼」用 Apps Script
 * （今ある下見・指値のApps Scriptとは別に、もう1つ作ります）
 *
 * 1. https://script.google.com で「新しいプロジェクト」→ このコードを全部貼り付けて保存
 *    （プロジェクト名は「ReKiL 下見条件」など）
 * 2. 左の歯車「プロジェクトの設定」→「スクリプト プロパティ」に
 *      PASSCODE = （下見・指値アプリと同じ暗証番号）
 *    を追加（コードには番号を書かない）
 * 3. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *      次のユーザーとして実行：自分 ／ アクセスできるユーザー：全員
 *    → 表示された「ウェブアプリのURL」をClaudeのチャットに送る
 *
 * データは「下見」と同じスプレッドシートの「下見条件」「下見依頼」シートに入ります。
 */
const SHEET_ID = "1ZLh29QONAg3smPMN96o-7OmA0kqtIT9-3A-uluSZnRk";
const RULE_SHEET = "下見条件";
const REQ_SHEET  = "下見依頼";
// 列の並び（1行目は見出し）。値はすべて文字のまま保存する
const R_COLS = ["id","auction","cat","kind","brands","exBrands","ranks","priceMin","priceMax","ngColors","lot","scope","dest","events","memo","order","updated"];
const R_HEAD = ["ID","オークション","カテゴリ","種類","ブランド","除外ブランド","状態ランク","開始価格 下限","開始価格 上限","NG色","点数","絞り込み","登録先","対象の開催","メモ","並び順","更新日時"];
const Q_COLS = ["id","auction","date","tk","memo","status","reqAt","notifiedAt","doneAt","result","who"];
const Q_HEAD = ["ID","オークション","開催日","大会","メモ","状態","依頼日時","お知らせ日時","完了日時","結果","依頼者"];

function doPost(e){
  let p = {}; try{ p = JSON.parse(e.postData.contents || "{}"); }catch(_){}
  const pass = PropertiesService.getScriptProperties().getProperty("PASSCODE");
  if(!pass) return out({ok:false, error:"passcode_not_set"});
  if(String(p.pass||"") !== String(pass)) return out({ok:false, error:"passcode"});
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try{
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const rs = sheet(ss, RULE_SHEET, R_HEAD), qs = sheet(ss, REQ_SHEET, Q_HEAD);
    let result = null;
    if(p.action === "saveRule"){
      const r = p.rule || {}; r.updated = now(); result = upsert(rs, R_COLS, r, "r");
    }else if(p.action === "removeRule"){
      remove(rs, String(p.id||""));
    }else if(p.action === "saveReq"){
      const r = p.req || {}; if(!r.reqAt) r.reqAt = now(); if(!r.status) r.status = "依頼中";
      result = upsert(qs, Q_COLS, r, "q");
    }else if(p.action === "removeReq"){
      remove(qs, String(p.id||""));
    }
    return out({ok:true, result, rules: list(rs, R_COLS), reqs: list(qs, Q_COLS).slice(-300)});
  }finally{ lock.releaseLock(); }
}
function sheet(ss, name, head){
  let sh = ss.getSheetByName(name);
  if(!sh){ sh = ss.insertSheet(name); sh.getRange(1,1,1,head.length).setValues([head]); sh.setFrozenRows(1); sh.getRange("A:Z").setNumberFormat("@"); }
  return sh;
}
function ids(sh){ const n = sh.getLastRow()-1; return n>0 ? sh.getRange(2,1,n,1).getValues().map(r=>String(r[0])) : []; }
function upsert(sh, cols, r, pre){
  if(!r.id) r.id = pre + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
  const row = cols.map(k => String(r[k] ?? ""));
  const i = ids(sh).indexOf(row[0]);
  const rg = i >= 0 ? sh.getRange(i+2, 1, 1, cols.length) : sh.getRange(sh.getLastRow()+1, 1, 1, cols.length);
  rg.setNumberFormat("@").setValues([row]);
  return row[0];
}
function remove(sh, id){ const i = ids(sh).indexOf(id); if(i >= 0) sh.deleteRow(i+2); }
function list(sh, cols){
  const n = sh.getLastRow()-1; if(n<=0) return [];
  const tz = Session.getScriptTimeZone();
  return sh.getRange(2,1,n,cols.length).getValues().filter(r=>r[0]).map(r=>{
    const o = {}; cols.forEach((k,i)=>{ const v = r[i]; o[k] = v instanceof Date ? Utilities.formatDate(v, tz, k==="date" ? "yyyy-MM-dd" : "yyyy/MM/dd HH:mm") : String(v ?? ""); }); return o; });
}
function now(){ return Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm"); }
function out(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
