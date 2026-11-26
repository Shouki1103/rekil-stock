"""電子帳簿の検索台帳（索引）を作る。
使い方: python3 tools/gen_daicho.py files.json 合言葉
files.json = [{"id":DriveのファイルID,"title":ファイル名}, ...]（電子書類/25年～ のPDF）。既存の索引に足していく（同じIDは上書き）。
ファイル名から 日付・取引先・金額 を読み取る。金額がファイル名にないものは、手入力分（amounts.json に {id: 金額}）を使う。
公開リポジトリなので、索引は合言葉で暗号化（AES-GCM）して daicho/index.enc.json に保存する。"""
import json, sys, re, os, base64, hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files, pw = json.load(open(sys.argv[1])), sys.argv[2]
cache = os.path.join(os.path.dirname(os.path.abspath(sys.argv[1])), "daicho_index_plain.json")
def old_rows():
    if os.path.exists(cache): return json.load(open(cache))
    e = os.path.join(root, "daicho", "index.enc.json")
    if not os.path.exists(e): return []
    j = json.load(open(e)); d = lambda x: base64.b64decode(x)
    k = hashlib.pbkdf2_hmac("sha256", pw.encode(), d(j["salt"]), 150000, 32)
    return json.loads(AESGCM(k).decrypt(d(j["iv"]), d(j["data"]), None))
idx = {r["id"]: r for r in old_rows()}
amts = json.load(open(os.path.join(os.path.dirname(os.path.abspath(sys.argv[1])), "daicho_amounts.json"))) if os.path.exists(os.path.join(os.path.dirname(os.path.abspath(sys.argv[1])), "daicho_amounts.json")) else {}
KIND = [("請求書","請求書"),("精算書","精算書"),("明細書","明細書"),("領収","領収書"),("納品書","納品書"),("計算書","計算書"),("輸出許可書","輸出許可書"),("利用料金","利用料金"),("確認書","確認書")]
def parse(t):
    s = re.sub(r"\.pdf$", "", t, flags=re.I); parts = s.split("_")
    d = ""; m = re.match(r"^(\d{8}|\d{6}|\d{4})$", parts[0])
    if m:
        v = m.group(1)
        d = f"{v[:4]}-{v[4:6]}-{v[6:]}" if len(v)==8 else f"20{v[:2]}-{v[2:4]}-{v[4:]}" if len(v)==6 else f"20{v[:2]}-{v[2:4]}"
        parts = parts[1:]
    nums = [p for p in parts if re.fullmatch(r"\d{3,8}", p)]
    amount = int(nums[-1]) if nums and len(nums[-1]) <= 7 else None
    partner = next((p for p in parts if not re.fullmatch(r"[\d回件]+", p) and p not in ("請求書","精算書","明細書")), "")
    partner = re.sub(r"(請求書|精算書|明細書|利用料金|計算書)$", "", partner) or partner
    kind = next((k for w,k in KIND if w in s), "")
    if re.fullmatch(r"\d{10}", s): return {"date": "", "partner": "DHL", "amount": None, "kind": "輸出許可書"}
    PK = {"セカンドストリート":"納品書","トレファクオンライン":"明細書","RAGTAGオンライン":"明細書","Amazon":"適格請求書","買取王国":"領収書","Yahoo":"領収証","彩洗工房":"請求書","ETC":"利用証明書","APRE":"請求書"}
    kind = kind or PK.get(partner, "書類")
    return {"date": d, "partner": partner, "amount": amount, "kind": kind}
for f in files:
    r = {"id": f["id"], "title": f["title"], **parse(f["title"])}
    if r["amount"] is None and f["id"] in amts: r["amount"] = amts[f["id"]]
    idx[f["id"]] = r
rows = sorted(idx.values(), key=lambda r: r["date"], reverse=True)
json.dump(rows, open(cache, "w"), ensure_ascii=False)
salt, iv = os.urandom(16), os.urandom(12)
key = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, 150000, 32)
ct = AESGCM(key).encrypt(iv, json.dumps(rows, ensure_ascii=False).encode(), None)
b = lambda x: base64.b64encode(x).decode()
json.dump({"v":1, "n": len(rows), "salt": b(salt), "iv": b(iv), "data": b(ct)}, open(os.path.join(root, "daicho", "index.enc.json"), "w"))
print("ok", len(rows), "件", sum(1 for r in rows if r["amount"]), "件に金額")
