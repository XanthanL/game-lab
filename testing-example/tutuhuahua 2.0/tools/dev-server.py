# -*- coding: utf-8 -*-
"""开发预览服务器:与 python -m http.server 相同,但响应带 no-store,
本地改完刷新即生效,不吃浏览器记忆缓存。

用法:
    python tools/dev-server.py [端口]     # 默认 8095
"""
import functools
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8095
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    handler = functools.partial(NoCacheHandler, directory=root)
    server = http.server.ThreadingHTTPServer(("", port), handler)
    print(f"预览 http://localhost:{port}/ (缓存已禁用,Ctrl+C 退出)")
    server.serve_forever()


if __name__ == "__main__":
    main()
