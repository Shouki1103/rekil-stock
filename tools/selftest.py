"""全アプリの動作チェック（ページが開けるか・スクリプトのエラーがないか）。
使い方: python3 tools/selftest.py [出力JSON]  （既定 check/selftest.json）
・ローカルでリポジトリを配信し、各アプリを画面幅390pxで開いてJavaScriptのエラーを集める
・インラインのスクリプトは node --check で構文も確認する
・外部（Apps Script・CDN・フォント）への通信の失敗は数えない（ここからは届かないため）"""
import asyncio, json, os, re, subprocess, sys, threading, datetime, functools, http.server, socketserver
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, "check", "selftest.json")
apps = [""] + sorted(d for d in os.listdir(root) if os.path.isfile(os.path.join(root, d, "index.html")) and not d.startswith("."))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
H = functools.partial(Q, directory=root)
class S(socketserver.ThreadingTCPServer): allow_reuse_address = True; daemon_threads = True
srv = S(("127.0.0.1", 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
def syntax(path):
    t = open(path, encoding="utf-8").read(); errs = []
    for i, s in enumerate(re.findall(r"<script>(.*?)</script>", t, re.S)):
        open("/tmp/_st.js", "w").write(s)
        r = subprocess.run(["node", "--check", "/tmp/_st.js"], capture_output=True, text=True)
        if r.returncode: errs.append("構文エラー: " + r.stderr.strip().splitlines()[-1][:160])
    for s in re.findall(r'<script src="([^"]+)"', t):
        if s.startswith("http"): continue
        p = os.path.normpath(os.path.join(os.path.dirname(path), s.split("?")[0]))
        if not os.path.exists(p): errs.append("読み込むファイルがない: " + s)
    return errs
async def main():
    from playwright.async_api import async_playwright
    res = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for a in apps:
            ctx = await b.new_context(viewport={"width": 390, "height": 844}); pg = await ctx.new_page(); errs = []
            await pg.route(re.compile(r"^https?://(?!127\.0\.0\.1).*"), lambda r: r.abort())
            pg.on("pageerror", lambda e: errs.append("実行エラー: " + str(e)[:200]))
            try:
                r = await pg.goto(f"http://127.0.0.1:{port}/{a}/" if a else f"http://127.0.0.1:{port}/", timeout=20000)
                await pg.wait_for_timeout(900)
                if not r or r.status >= 400: errs.append(f"ページが開けない（{r.status if r else '応答なし'}）")
                title = await pg.title()
            except Exception as e:
                errs.append("ページが開けない: " + str(e)[:160]); title = ""
            errs = syntax(os.path.join(root, a, "index.html")) + [e for e in errs if "Failed to fetch" not in e and "NetworkError" not in e and "Load failed" not in e]
            res.append({"app": a or "(在庫 ReKiL Stock)", "title": title, "ok": not errs, "errors": errs})
            await ctx.close()
        await b.close()
    return res
res = asyncio.run(main()); srv.shutdown()
os.makedirs(os.path.dirname(out), exist_ok=True)
ng = [r for r in res if not r["ok"]]
json.dump({"at": datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).strftime("%Y-%m-%d %H:%M"), "total": len(res), "ng": len(ng), "apps": res}, open(out, "w"), ensure_ascii=False, indent=1)
print(f"{len(res)}アプリ中 {len(ng)}件エラー"); [print(" ✕", r["app"], r["errors"]) for r in ng]
