/* ReKiL 出品データ：オークションごとの雛形の書き方
   雛形を追加・変更するときはここだけ直す（tpl/ に雛形ファイルを置く） */
(function(root){
const S = v => String(v ?? "").trim();
const num = v => { const n = +String(v ?? "").replace(/[,，円\s]/g, "").normalize("NFKC"); return isFinite(n) && String(v ?? "").trim() !== "" ? n : ""; };
const join = (...a) => a.map(S).filter(Boolean).join(" ");
/* 付属品「箱/保存袋」→「/箱/保存袋付属」 */
const accTxt = a => { const t = S(a).split(/[\/／、,，・\s]+/).filter(Boolean); return t.length ? "/" + t.join("/") + "付属" : ""; };
/* エコリングはカンマ・ダブルクォート・＆・改行が使えない */
const ecoSafe = v => S(v).replace(/[\r\n]+/g, " ").replace(/[,，]/g, " ").replace(/["＂]/g, "").replace(/[＆&]/g, "and").replace(/\s{2,}/g, " ");
const md = d => { if(!d) return ""; const x = new Date(d + "T00:00:00"); return `${x.getMonth()+1}月${x.getDate()}日`; };
const ymdJa = d => { const x = new Date(d + "T00:00:00"); return `${x.getFullYear()}年${String(x.getMonth()+1).padStart(2,"0")}月${String(x.getDate()).padStart(2,"0")}日`; };
const today = () => new Date(Date.now() + 9*3600e3).toISOString().slice(0,10);
/* 箱番の入力「231,233」→ 10点ずつ順に割り当て */
const boxList = s => S(s).normalize("NFKC").split(/[\s,、・\/]+/).filter(Boolean);
const boxOf = (L, i, per = 10) => { const b = boxList(L.boxes); const k = Math.floor(i / per); return {box: b[k] !== undefined ? (num(b[k]) !== "" ? num(b[k]) : b[k]) : "", eda: b.length ? (i % per) + 1 : ""}; };

/* プライムのブランドは決められた一覧から選ぶ（ない場合は「その他(other)」にして商品名の先頭にブランド名） */
const PRIME_BRANDS = ["ルイヴィトン(LOUIS VUITTON)","シャネル(CHANEL)","エルメス(Hermès)","グッチ(GUCCI)","セリーヌ(CELINE)","バレンシアガ(BALENCIAGA)","コーチ(Coach)","プラダ(PRADA)","ディオール(Dior)","クリスチャン ディオール(Christian Dior)","フェンディ(FENDI)","ロエベ(LOEWE)","サンローラン(Saint Laurent)","イヴ・サンローラン(Yves Saint Laurent)","ジバンシィ(GIVENCHY)","ボッテガヴェネタ(BOTTEGA VENETA)","クロエ(chloe)","サルヴァトーレ フェラガモ(Salvatore Ferragamo)","クリスチャン ルブタン(Christian Louboutin)","ヴァレンティノ(Valentino)","ベルルッティ(Berluti)","ゴヤール(GOYARD)","ミュウミュウ(MiuMiu)"];
const key = s => S(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
function primeBrand(b){
  const k = key(b); if(!k) return {brand: "", other: false};
  const alias = {LOUISVUITTON:"LOUISVUITTON", VUITTON:"LOUISVUITTON", LV:"LOUISVUITTON", DIOR:"CHRISTIANDIOR", YSL:"YVESSAINTLAURENT", SAINTLAURENTPARIS:"SAINTLAURENT", FERRAGAMO:"SALVATOREFERRAGAMO", BOTTEGA:"BOTTEGAVENETA", LOUBOUTIN:"CHRISTIANLOUBOUTIN", VALENTINOGARAVANI:"VALENTINO"};
  const want = alias[k] || k;
  const hit = PRIME_BRANDS.find(x => key((/\(([^)]*)\)/.exec(x) || [])[1]) === want);
  return hit ? {brand: hit, other: false} : {brand: "その他(other)", other: true};
}

const AUC = [
  { id: "jds", name: "JDS", file: "tpl/jds.xlsx", ext: "xlsx", sheet: "出品商品_テンプレート", first: 2,
    clear: [["出品商品_テンプレート", "A", "Z", 2, 2000]],
    fields: ["rank", "model", "acc", "damage", "kanri"], boxes: "箱番（予約した番号。例：231,233）",
    mail: "jdss201501@gmail.com", subject: L => `${md(L.date)}開催分 出品リスト`,
    note: "品名にダメージ（破れ・ひび割れ・金具不良など）を書かないと返品対象になることがあります。売り切りは指値0。",
    row: (it, i, L) => { const b = boxOf(L, i); return { A: 1062, C: b.box, D: b.eda, G: S(it.brand).toUpperCase() || (it.set ? "SET" : ""),
      H: join(it.name, it.model, accTxt(it.acc), it.damage), I: S(it.rank), S: num(it.price), U: S(it.kanri) }; } },

  { id: "jwa", name: "JWA", file: "tpl/jwa.xlsx", ext: "xlsx", sheet: "データ用", first: 7,
    clear: [["データ用", "A", "Q", 7, 2000]],
    fields: ["model", "material", "serial", "acc", "betten"], boxes: "箱番号（例：31）",
    mail: "info@jwa29.jp", subject: L => `${md(L.date)} JWAブランド大会 出品リスト`,
    note: "指値は50,000円以上が目安。高額・大型・壊れやすいものは別展。",
    head: (sh, L) => { const d = new Date(L.date + "T00:00:00");
      sh.set("A2", `大会日：　　　　${String(d.getFullYear()).slice(2)}年　　　　${d.getMonth()+1}月　　${d.getDate()}日　　　　`); },
    row: (it, i, L) => { const b = boxOf(L, i); return { A: b.box, B: b.eda, C: S(it.brand), D: S(it.model),
      G: join(it.name, it.material, it.serial, it.damage), H: S(it.acc).replace(/[、,，・\s]+/g, "/"), L: num(it.price), O: it.betten ? "希望" : "" }; } },

  { id: "apre", name: "アプレ", file: "tpl/apre.xlsm", ext: "xlsm", sheet: "入力欄 (3)", first: 6, max: 500,
    clear: [["入力欄 (3)", "E", "L", 6, 505], ["入力欄 (3)", "N", "N", 6, 505], ["入力欄 (2)", "E", "L", 6, 505], ["入力欄 (2)", "N", "N", 6, 505]],
    fields: ["rank", "line", "model", "color", "material", "acc", "damage", "hold"], boxes: "区分＋先頭箱番（例：B195）",
    mail: "", subject: L => `${md(L.date)} アプレオークション 出品リスト`,
    note: "箱番は先頭箱番から10点ずつ自動で振られます。ランクは N・S・SA・A・AB・B・BC・C・ジャンク。",
    head: (sh, L, n) => { const m = /^([A-Za-zＡ-Ｚａ-ｚ]*)\s*(\d+)/.exec(S(L.boxes).normalize("NFKC"));
      if(m){ if(m[1]) sh.set("C3", m[1].toUpperCase()); sh.set("D3", +m[2]); }
      sh.set("F3", Math.max(1, Math.ceil(n / 10)));
      if(L.date) sh.set("I3", `${new Date(L.date + "T00:00:00").getMonth()+1}月`); },
    row: it => ({ E: S(it.brand), F: S(it.line), G: S(it.name), H: S(it.model), I: S(it.color), J: S(it.material),
      K: S(it.rank) === "ジャンク品" ? "ジャンク" : S(it.rank), L: join(accTxt(it.acc), it.damage), M: it.hold === "否" ? "否" : "可", N: num(it.price) }) },

  { id: "prime", name: "プライム", file: "tpl/prime.xlsx", ext: "xlsx", sheet: "ブランド", first: 9,
    clear: [["ブランド", "B", "P", 9, 9716]],
    fields: ["rank", "line", "model", "serial", "material", "color", "acc", "damage", "kanri"], boxes: "箱番（例：166,167）",
    mail: "", subject: L => `${md(L.date)} プライムオークション 出品リスト`,
    note: "ブランドはプライムの一覧にあるものはそのまま、ないものは「その他」になり商品名の先頭にブランド名が入ります。",
    head: (sh, L) => { if(L.date) sh.set("D5", `${md(L.date)}　ブランド大会`); },
    row: (it, i, L) => { const b = boxOf(L, i), pb = primeBrand(it.brand); return { B: b.box, C: b.eda, D: pb.brand,
      E: pb.other ? join(it.brand, it.name) : S(it.name), F: S(it.line), G: S(it.model), H: S(it.serial), I: S(it.material), J: S(it.color),
      K: S(it.acc), L: S(it.damage), M: S(it.rank), O: num(it.price), P: S(it.kanri) }; } },

  { id: "ecooku", name: "エコオク（ブランド市）", file: "tpl/ecooku.xlsx", ext: "xlsx", sheet: "委託者入力シート", first: 20,
    clear: [["委託者入力シート", "B", "E", 20, 1019], ["委託者入力シート", "C", "C", 10, 12]],
    fields: ["model", "acc", "damage", "kanri"], tracking: true,
    mail: "", subject: L => `${md(L.date)} エコリング ブランド市 委託出品依頼書`,
    note: "カンマ・ダブルクォート・＆・改行は自動で取り除きます。管理番号はメモ欄（下見画面に出ない欄）に入ります。追跡番号は必須。",
    head: (sh, L) => { sh.set("C10", XLd(today())); sh.set("C11", S(L.tracking)); if(L.date) sh.set("C12", XLd(L.date)); },
    row: it => ({ B: ecoSafe(join(it.brand, it.name, it.model, accTxt(it.acc))), C: num(it.price), D: ecoSafe(it.damage), E: ecoSafe(it.kanri) }) },

  { id: "ecotre", name: "エコトレ（道具市）", file: "tpl/ecotre.xlsx", ext: "xlsx", sheet: "委託者入力シート", first: 20,
    clear: [["委託者入力シート", "B", "E", 20, 1019], ["委託者入力シート", "C", "C", 10, 13]],
    fields: ["model", "acc", "damage", "kanri"], tracking: true, area: true,
    mail: "", subject: L => `${md(L.date)} エコリング 道具市 委託出品依頼書`,
    note: "販売希望エリア（関東／関西）を選んでください。カンマ・＆・改行は自動で取り除きます。追跡番号は必須。",
    head: (sh, L) => { sh.set("C10", ymdJa(today())); sh.set("C11", L.area || "関東"); sh.set("C12", S(L.tracking)); if(L.date) sh.set("C13", XLd(L.date)); },
    row: it => ({ B: ecoSafe(join(it.brand, it.name, it.model, accTxt(it.acc))), C: num(it.price), D: ecoSafe(it.damage), E: ecoSafe(it.kanri) }) },
];
function XLd(iso){ const t = Date.parse(iso + "T00:00:00Z"); return Math.round(t/864e5) + 25569; }

/* 雛形に書き込んでファイルを作る */
async function build(L, items, env, tplData){
  const a = AUC.find(x => x.id === L.auction); const book = await env.XL.Book.open(tplData, env);
  for(const [sn, c1, c2, r1, r2] of a.clear){ const sh = await book.sheet(sn); sh.clear(c1, c2, r1, r2); }
  const sh = await book.sheet(a.sheet);
  if(a.head) a.head(sh, L, items.length);
  items.forEach((it, i) => { const r = a.first + i; const cells = a.row(it, i, L);
    for(const [c, v] of Object.entries(cells)) sh.set(c + r, v, {keepFormula: true}); });
  return book;
}
/* 出す前の確認 */
function check(L, items){
  const a = AUC.find(x => x.id === L.auction), w = [];
  if(!items.length) w.push("商品が1件もありません");
  const np = items.filter(i => num(i.price) === "").length; if(np) w.push(`指値が空の商品が${np}件あります`);
  const nb = items.filter(i => !S(i.brand)).length; if(nb) w.push(`ブランドが空の商品が${nb}件あります`);
  if(a.tracking && !S(L.tracking)) w.push("配送業者の追跡番号が入っていません（必須）");
  if(a.boxes && a.id !== "apre" && boxList(L.boxes).length && boxList(L.boxes).length * 10 < items.length) w.push(`箱番が足りません（${boxList(L.boxes).length}箱＝${boxList(L.boxes).length*10}点まで、商品は${items.length}点）`);
  if(a.id === "jwa"){ const lo = items.filter(i => num(i.price) !== "" && num(i.price) < 50000).length; if(lo) w.push(`指値が50,000円未満の商品が${lo}件あります（JWAは50,000円以上が目安）`); }
  if(a.id === "prime"){ const o = items.filter(i => S(i.brand) && primeBrand(i.brand).other).map(i => S(i.brand)); if(o.length) w.push(`プライムの一覧にないブランドは「その他」で出します：${[...new Set(o)].join("・")}`); }
  if(a.max && items.length > a.max) w.push(`この雛形は${a.max}点までです`);
  return w;
}
const API = {AUC, build, check, primeBrand, boxOf, md};
if(typeof module !== "undefined") module.exports = API; else root.AUCS = API;
})(this);
