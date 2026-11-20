#!/usr/bin/env python3
"""実機テスト用のローカルサーバー（python3 -m http.server の代わりに使う）。

- リポジトリを http://localhost:8080/ で配信する（Web Bluetooth は localhost で動く）
- 各ページの SDK（orphe-core-insole.js）の直後に scripts/devtest/overlay.js を差し込む。
  ページのファイルは書き換えない（配信するときだけ差し込む）
- パネルの「保存」で、結果を JSON で結果フォルダに書く。/__devtest/report.html で一覧できる
- キャッシュを無効にする（直したファイルが再読み込みだけで反映される）

使い方（リポジトリのルートで）:
    python3 scripts/devtest/serve.py
    python3 scripts/devtest/serve.py --results-dir ~/Desktop/devtest-results --port 8080
標準ライブラリだけで動く（追加のインストール不要）。
"""
import argparse, datetime, http.server, json, os, pathlib, re, subprocess, sys, urllib.parse

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SDK_TAG = re.compile(rb'(<script[^>]*orphe-core-insole\.js["\'][^>]*>\s*</script>)', re.I)
INJECT = '\n  <script src="/__devtest/overlay.js"></script><!-- devtest: serve.py が差し込み -->'.encode('utf-8')


def git_info(root):
    def run(*a):
        try:
            return subprocess.run(['git', '-C', str(root), *a], capture_output=True, text=True, timeout=5).stdout.strip()
        except Exception:
            return ''
    return {'branch': run('rev-parse', '--abbrev-ref', 'HEAD'), 'commit': run('rev-parse', '--short', 'HEAD'),
            'dirty': bool(run('status', '--porcelain', '--untracked-files=no'))}


def make_handler(root, results):
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(root), **kw)

        def log_message(self, fmt, *args):
            if self.path.startswith('/__devtest/save'):
                sys.stderr.write('[devtest] ' + (fmt % args) + '\n')

        def end_headers(self):
            self.send_header('Cache-Control', 'no-store')
            super().end_headers()

        def _send(self, code, body, ctype):
            self.send_response(code)
            self.send_header('Content-Type', ctype)
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            path = urllib.parse.urlparse(self.path).path
            if path.startswith('/__devtest/'):
                name = path[len('/__devtest/'):]
                if name == 'results':
                    items = []
                    for f in sorted(results.glob('*.json')):
                        try:
                            items.append(json.loads(f.read_text(encoding='utf-8')) | {'_file': f.name})
                        except Exception:
                            pass
                    return self._send(200, json.dumps(items, ensure_ascii=False).encode(), 'application/json; charset=utf-8')
                f = HERE / name
                if name in ('overlay.js', 'report.html') and f.is_file():
                    ctype = 'text/javascript; charset=utf-8' if name.endswith('.js') else 'text/html; charset=utf-8'
                    return self._send(200, f.read_bytes(), ctype)
                return self._send(404, b'not found', 'text/plain')
            fs = pathlib.Path(self.translate_path(path))
            if fs.is_dir():
                fs = fs / 'index.html'
                if not path.endswith('/'):
                    return super().do_GET()   # let the base class redirect to the slash URL
            if fs.suffix == '.html' and fs.is_file():
                body = fs.read_bytes()
                body, n = SDK_TAG.subn(lambda m: m.group(1) + INJECT, body, count=1)
                return self._send(200, body, 'text/html; charset=utf-8')
            return super().do_GET()

        def do_POST(self):
            if urllib.parse.urlparse(self.path).path != '/__devtest/save':
                return self._send(404, b'not found', 'text/plain')
            n = int(self.headers.get('Content-Length') or 0)
            data = json.loads(self.rfile.read(n) or b'{}')
            data['git'] = git_info(root)
            stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
            page = re.sub(r'[^\w.-]+', '_', str(data.get('page') or 'page'))
            kinds = '-'.join(sorted({d.get('kind', '?') for d in data.get('devices', [])})) or 'nodev'
            f = results / f'{stamp}_{page}_{kinds}.json'
            f.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')
            return self._send(200, json.dumps({'file': str(f)}, ensure_ascii=False).encode(), 'application/json; charset=utf-8')
    return Handler


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--port', type=int, default=8080)
    ap.add_argument('--root', default=str(ROOT), help='配信するフォルダ（既定: このリポジトリ）')
    ap.add_argument('--results-dir', default='~/orphe-devtest-results', help='結果 JSON の保存先（既定: ~/orphe-devtest-results）')
    a = ap.parse_args()
    root = pathlib.Path(a.root).expanduser().resolve()
    results = pathlib.Path(a.results_dir).expanduser()
    results.mkdir(parents=True, exist_ok=True)
    g = git_info(root)
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', a.port), make_handler(root, results))
    print(f'devtest: http://localhost:{a.port}/   （{g.get("branch")} {g.get("commit")}{" ・未コミットの変更あり" if g.get("dirty") else ""}）')
    print(f'devtest: 結果の保存先 {results}')
    print(f'devtest: 一覧 http://localhost:{a.port}/__devtest/report.html   止めるときは Ctrl+C')
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
