"""電子書類の保存状況と輸出許可書の進捗を、アプリ用のJSONにする。
使い方: python3 tools/gen_shorui.py dump.json
dump.json = {"sites": サイト一覧!A1:C の値, "done": 完了記録!A1:E の値, "nashi": 明細なし一覧!A1:C の値, "yushutsu": 輸出許可書進捗_YY年!A1:G の値}
（スプレッドシート「電子書類 自動保存ルール」 1bAn7gPKHGI82Xw_4wHtn_xUg-CSrqDnC539elXVXXcU）
金額などの明細は公開リポジトリに載せないため、サイト名・対象月・結果だけを書き出す。"""
import json, sys, re, datetime, os
D = json.load(open(sys.argv[1]))
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def ym(s):
    m = re.search(r"(20\d\d)年(\d{1,2})月", s or "")
    return f"{m.group(1)}-{int(m.group(2)):02d}" if m else ""
sites = []
for r in D["sites"][1:]:
    if not r or not r[0]: continue
    day, on = (r[1] if len(r)>1 else ""), (r[2] if len(r)>2 else "")
    if on.startswith("無効"): continue
    m = re.match(r"\s*(\d{1,2})\b", day)
    d = int(m.group(1)) if m else ("end" if day.startswith("月末") else None)
    if d is None: continue
    fm = re.search(r"(20\d\d)/(\d{1,2})/(\d{1,2})〜", day)
    sites.append({"name": r[0], "day": d, "auto": on.startswith("自動") or "完全自動" in day, "from": f"{fm.group(1)}-{int(fm.group(2)):02d}-{int(fm.group(3)):02d}" if fm else ""})
done = {}
for r in D["done"][1:]:
    if len(r) < 5: continue
    k = ym(r[1])
    if not k: continue
    for s in sites:
        if s["name"] == r[2] or (s["name"].split("（")[0] == r[2].split("（")[0] and s["name"].split("（")[0] not in ("Payoneer", "GMOあおぞら", "OrangeConnex", "税理士報告", "トレファクオンライン", "オークネット")):
            done.setdefault(s["name"], {})[k] = r[4]
for r in D.get("nashi", [])[1:]:
    if len(r) >= 3 and ym(r[1]): done.setdefault(r[2], {}).setdefault(ym(r[1]), "明細なし")
json.dump({"updated": datetime.date.today().isoformat(), "sites": sites, "done": done}, open(os.path.join(root, "shorui", "status.json"), "w"), ensure_ascii=False, indent=1)
yu = []
for r in D.get("yushutsu", [])[1:]:
    if len(r) < 2: continue
    r = r + [""]*7
    yu.append({"month": r[0], "carrier": r[1], "req": r[2] == "TRUE", "reqAt": r[3], "got": r[4] == "TRUE", "gotAt": r[5], "memo": r[6]})
json.dump({"updated": datetime.date.today().isoformat(), "rows": yu}, open(os.path.join(root, "yushutsu", "status.json"), "w"), ensure_ascii=False, indent=1)
print("ok", len(sites), "sites", sum(len(v) for v in done.values()), "records", len(yu), "yushutsu")
