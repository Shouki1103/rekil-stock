/* ReKiL 出品データ：オークションの雛形Excel（xlsx/xlsm）のセルだけを書き換える小さな道具
   書式・プルダウン・マクロはそのまま残し、値だけを入れ替えます。
   ブラウザでもNode（雛形の掃除用）でも動くように、JSZip と DOMParser を外から受け取ります。 */
(function(root){
const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const RNS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
function colNum(s){ let n = 0; for(const ch of s) n = n*26 + (ch.charCodeAt(0)-64); return n; }
function colName(n){ let s = ""; while(n > 0){ const m = (n-1) % 26; s = String.fromCharCode(65+m) + s; n = Math.floor((n-1)/26); } return s; }
function splitRef(ref){ const m = /^([A-Z]+)(\d+)$/.exec(ref); return {c: colNum(m[1]), r: +m[2]}; }
/* Excelの日付（シリアル値）：1900年基準 */
function dateSerial(iso){ const t = Date.parse(iso + "T00:00:00Z"); return Math.round(t/864e5) + 25569; }

class Book{
  constructor(zip, env){ this.zip = zip; this.env = env; this.docs = {}; }
  static async open(data, env){ const zip = await env.JSZip.loadAsync(data); const b = new Book(zip, env); await b._index(); return b; }
  async _xml(path){ if(!this.docs[path]){ const t = await this.zip.file(path).async("string"); this.docs[path] = new this.env.DOMParser().parseFromString(t, "application/xml"); } return this.docs[path]; }
  async _index(){
    const wb = await this._xml("xl/workbook.xml");
    const rels = await this._xml("xl/_rels/workbook.xml.rels");
    const map = {}; for(const r of Array.from(rels.getElementsByTagName("Relationship"))) map[r.getAttribute("Id")] = r.getAttribute("Target");
    this.sheets = {};
    for(const s of Array.from(wb.getElementsByTagName("sheet"))){
      let t = map[s.getAttributeNS(RNS, "id") || s.getAttribute("r:id")]; t = t.replace(/^\/?xl\//, "").replace(/^\//, "");
      this.sheets[s.getAttribute("name")] = "xl/" + t;
    }
  }
  async sheet(name){ const p = this.sheets[name]; if(!p) throw new Error("シートがありません：" + name); return new Sheet(await this._xml(p)); }
  async sharedStrings(){ return this.zip.file("xl/sharedStrings.xml") ? await this._xml("xl/sharedStrings.xml") : null; }
  async save(type){
    /* 開いたときに計算し直してもらう（箱番の式など） */
    const wb = await this._xml("xl/workbook.xml");
    let cp = wb.getElementsByTagName("calcPr")[0];
    if(!cp){ cp = wb.createElementNS(NS, "calcPr"); wb.documentElement.appendChild(cp); }
    cp.setAttribute("fullCalcOnLoad", "1");
    const ser = new this.env.XMLSerializer();
    for(const [p, d] of Object.entries(this.docs)) this.zip.file(p, ser.serializeToString(d));
    return this.zip.generateAsync({type, compression: "DEFLATE"});
  }
}
class Sheet{
  constructor(doc){ this.doc = doc; this.data = doc.getElementsByTagName("sheetData")[0]; this.rows = new Map();
    for(const r of Array.from(this.data.getElementsByTagName("row"))) this.rows.set(+r.getAttribute("r"), r); }
  _row(n, make){
    let r = this.rows.get(n); if(r || !make) return r;
    r = this.doc.createElementNS(NS, "row"); r.setAttribute("r", String(n));
    let next = null; for(const [k, el] of this.rows) if(k > n && (!next || k < +next.getAttribute("r"))) next = el;
    this.data.insertBefore(r, next); this.rows.set(n, r); return r;
  }
  _cell(ref, make){
    const {c, r} = splitRef(ref); const row = this._row(r, make); if(!row) return null;
    let after = null;
    for(const el of Array.from(row.getElementsByTagName("c"))){
      const cc = splitRef(el.getAttribute("r")).c;
      if(cc === c) return el; if(cc > c){ after = el; break; }
    }
    if(!make) return null;
    const el = this.doc.createElementNS(NS, "c"); el.setAttribute("r", ref);
    /* 行の書式を引き継ぐ */
    row.insertBefore(el, after); row.removeAttribute("spans"); return el;
  }
  hasFormula(ref){ const el = this._cell(ref, false); return !!(el && el.getElementsByTagName("f").length); }
  /* 値を入れる。null・"" は空にする（書式は残す）。式の入ったセルは keepFormula のとき触らない */
  set(ref, v, opt = {}){
    const empty = v === null || v === undefined || v === "";
    let el = this._cell(ref, !empty); if(!el) return;
    if(opt.keepFormula && el.getElementsByTagName("f").length) return;
    while(el.firstChild) el.removeChild(el.firstChild);
    el.removeAttribute("t");
    if(empty) return;
    if(typeof v === "number" && isFinite(v)){
      const x = this.doc.createElementNS(NS, "v"); x.textContent = String(v); el.appendChild(x);
    }else{
      el.setAttribute("t", "inlineStr");
      const is = this.doc.createElementNS(NS, "is"), t = this.doc.createElementNS(NS, "t");
      t.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve"); t.textContent = String(v); is.appendChild(t); el.appendChild(is);
    }
  }
  /* 範囲の値を空にする（式は残す） */
  clear(c1, c2, r1, r2){
    const a = colNum(c1), b = colNum(c2);
    for(const [n, row] of this.rows){ if(n < r1 || n > r2) continue;
      for(const el of Array.from(row.getElementsByTagName("c"))){
        const cc = splitRef(el.getAttribute("r")).c; if(cc < a || cc > b) continue;
        if(el.getElementsByTagName("f").length) continue;
        while(el.firstChild) el.removeChild(el.firstChild); el.removeAttribute("t");
      } }
  }
}
const XL = {Book, colNum, colName, dateSerial};
if(typeof module !== "undefined") module.exports = XL; else root.XL = XL;
})(this);
