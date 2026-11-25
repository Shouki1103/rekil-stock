/**
 * ReKiL 出品データ 用 Apps Script
 * 1. https://script.google.com で「新しいプロジェクト」→ このコードを全部貼り付けて保存
 * 2. 左の歯車「プロジェクトの設定」→「スクリプト プロパティを追加」
 *      PASSCODE = （ほかのReKiLアプリと同じ暗証番号）
 * 3. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *      次のユーザーとして実行：自分 ／ アクセスできるユーザー：全員
 *    → 表示された「ウェブアプリのURL」をチャットに送る
 * データ用のスプレッドシート「ReKiL 出品データ」は最初の通信で自動で作られます（マイドライブ）。
 */
const LIST_HEAD = ["id", "オークション", "開催日", "状態", "点数", "指値合計", "更新", "データ"];
const ITEM_HEAD = ["リストid", "順", "管理番号", "ブランド", "商品名", "指値", "データ"];

function doPost(e){
  let p = {}; try{ p = JSON.parse(e.postData.contents || "{}"); }catch(_){}
  const pass = PropertiesService.getScriptProperties().getProperty("PASSCODE");
  if(!pass) return out({ok:false, error:"passcode_not_set"});
  if(String(p.pass || "") !== String(pass)) return out({ok:false, error:"passcode"});
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try{
    const ss = book_(); const ls = sheet_(ss, "リスト", LIST_HEAD), is = sheet_(ss, "商品", ITEM_HEAD);
    let result = null;
    if(p.action === "save"){ (p.lists || (p.list ? [p.list] : [])).forEach(L => saveList_(ls, is, L)); result = true; }
    else if(p.action === "remove"){ removeList_(ls, is, String(p.id || "")); result = true; }
    return out({ok:true, result, data:{lists: load_(ls, is)}, sheet: ss.getUrl()});
  }catch(err){ return out({ok:false, error:String(err && err.message || err)}); }
  finally{ lock.releaseLock(); }
}
function doGet(){ return out({ok:true, app:"ReKiL 出品データ"}); }

function book_(){
  const pr = PropertiesService.getScriptProperties(); let id = pr.getProperty("SHEET_ID");
  if(id){ try{ return SpreadsheetApp.openById(id); }catch(_){} }
  const ss = SpreadsheetApp.create("ReKiL 出品データ"); pr.setProperty("SHEET_ID", ss.getId());
  const first = ss.getSheets()[0]; first.setName("リスト"); return ss;
}
function sheet_(ss, name, head){
  let sh = ss.getSheetByName(name); if(!sh) sh = ss.insertSheet(name);
  if(sh.getLastRow() === 0){ sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight("bold"); sh.setFrozenRows(1); }
  return sh;
}
function rows_(sh, n){ const m = sh.getLastRow() - 1; return m > 0 ? sh.getRange(2, 1, m, n).getValues() : []; }
function rewrite_(sh, n, rows){
  const m = sh.getLastRow() - 1; if(m > 0) sh.getRange(2, 1, m, n).clearContent();
  if(rows.length) sh.getRange(2, 1, rows.length, n).setValues(rows);
}
function saveList_(ls, is, L){
  if(!L || !L.id) return;
  const items = L.items || []; const meta = Object.assign({}, L); delete meta.items;
  const sum = items.reduce((a, i) => a + (+String(i.price || "").replace(/[^\d]/g, "") || 0), 0);
  const row = [L.id, L.auction || "", L.date || "", L.status || "draft", items.length, sum, new Date(), JSON.stringify(meta)];
  const lr = rows_(ls, LIST_HEAD.length); const k = lr.findIndex(r => String(r[0]) === L.id);
  if(k >= 0) ls.getRange(k + 2, 1, 1, LIST_HEAD.length).setValues([row]); else ls.appendRow(row);
  const keep = rows_(is, ITEM_HEAD.length).filter(r => String(r[0]) !== L.id);
  items.forEach((it, i) => keep.push([L.id, i + 1, it.kanri || "", it.brand || "", it.name || "", it.price || "", JSON.stringify(it)]));
  rewrite_(is, ITEM_HEAD.length, keep);
}
function removeList_(ls, is, id){
  const lr = rows_(ls, LIST_HEAD.length); const k = lr.findIndex(r => String(r[0]) === id);
  if(k >= 0) ls.deleteRow(k + 2);
  rewrite_(is, ITEM_HEAD.length, rows_(is, ITEM_HEAD.length).filter(r => String(r[0]) !== id));
}
function load_(ls, is){
  const by = {};
  rows_(is, ITEM_HEAD.length).forEach(r => { try{ (by[r[0]] = by[r[0]] || []).push(JSON.parse(r[6])); }catch(_){} });
  return rows_(ls, LIST_HEAD.length).filter(r => r[0]).map(r => { let m = {}; try{ m = JSON.parse(r[7]); }catch(_){}
    m.id = String(r[0]); m.items = by[m.id] || []; return m; });
}
function out(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
