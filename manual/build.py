"""説明書のHTMLとPDFを作る： python3 manual/build.py （manuals.json を直したら実行）"""
import json, os, subprocess, html, sys
D = os.path.dirname(os.path.abspath(__file__))
m = json.load(open(os.path.join(D, "manuals.json")))
os.makedirs(os.path.join(D, "pdf"), exist_ok=True)
CSS = """@page{size:A4;margin:16mm 14mm}body{font-family:'Noto Sans CJK JP','Noto Sans JP','Hiragino Sans',sans-serif;color:#1d232a;font-size:11.5pt;line-height:1.7}
h1{font-size:20pt;margin:0 0 4px;border-left:8px solid #f2a541;padding-left:10px}.sub{color:#667;font-size:9.5pt;margin-bottom:14px}
h2{font-size:12.5pt;margin:16px 0 6px;color:#0d1014;border-bottom:1px solid #dde;padding-bottom:3px}ol,ul{margin:0;padding-left:1.4em}li{margin:3px 0}
.what{background:#fff6e8;border-radius:8px;padding:10px 12px}.url{font-size:9.5pt;color:#556;word-break:break-all}.app{page-break-after:always}.app:last-child{page-break-after:auto}"""
BASE = "https://shouki1103.github.io/rekil-stock/manual/"
def absurl(u): return u if u.startswith("http") else "https://shouki1103.github.io/rekil-stock/" + u.replace("../","",1)
def block(a):
    e = html.escape
    return f"""<section class="app"><h1>{e(a['name'])}</h1><div class="sub">ReKiL アプリ説明書　更新 {e(m['updated'])}</div>
<div class="what">{e(a['what'])}</div><h2>使い方</h2><ol>{''.join(f'<li>{e(s)}</li>' for s in a['steps'])}</ol>
<h2>ポイント</h2><ul>{''.join(f'<li>{e(s)}</li>' for s in a['tips'])}</ul>
<h2>アプリの場所</h2><div class="url">{e(absurl(a['url']))}</div></section>"""
def page(title, body): return f"<!DOCTYPE html><html lang='ja'><head><meta charset='utf-8'><title>{html.escape(title)}</title><style>{CSS}</style></head><body>{body}</body></html>"
common = "<section class='app'><h1>ReKiL アプリ共通のルール</h1><div class='sub'>更新 "+html.escape(m['updated'])+"</div><ul>"+"".join(f"<li>{html.escape(s)}</li>" for s in m['common'])+"</ul></section>"
def pdf(src, out):
    subprocess.run(["google-chrome","--headless=new","--no-sandbox","--disable-gpu","--no-pdf-header-footer",f"--print-to-pdf={out}","file://"+src], check=True, capture_output=True)
tmp = "/tmp/rekil-manual"; os.makedirs(tmp, exist_ok=True)
for a in m["apps"]:
    src = f"{tmp}/{a['id']}.html"; open(src,"w").write(page(a['name']+" 説明書", block(a)))
    pdf(src, os.path.join(D, "pdf", f"{a['id']}.pdf"))
src = f"{tmp}/all.html"; open(src,"w").write(page("ReKiL アプリ説明書（全部）", common + "".join(block(a) for a in m["apps"])))
pdf(src, os.path.join(D, "pdf", "all.pdf"))
print("ok", len(m["apps"]))
