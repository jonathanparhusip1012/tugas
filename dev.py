#!/usr/bin/env python3
"""
Server lokal untuk pengembangan — meniru perilaku GitHub Pages.

  1. Jalankan:  python3 dev.py
  2. Buka:      http://localhost:8000
                http://localhost:8000/promo
                http://localhost:8000/admin

GitHub Pages otomatis melayani /promo dari promo.html. Server bawaan
`python -m http.server` tidak bisa, jadi skrip kecil ini dipakai agar URL
tanpa .html tetap jalan saat dites di komputer sendiri.
"""

import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))


class PrettyURLHandler(SimpleHTTPRequestHandler):
    """Layani /promo dari promo.html, seperti GitHub Pages."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def translate_path(self, path):
        jalur = super().translate_path(path)

        # /promo -> promo.html (hanya bila file tanpa ekstensi tidak ada)
        if not os.path.exists(jalur) and not os.path.splitext(jalur)[1]:
            kandidat = jalur + ".html"
            if os.path.isfile(kandidat):
                return kandidat

        return jalur

    def _alihkan_tanpa_slash(self):
        """/promo/ -> /promo agar path relatif (assets/...) tetap benar."""
        path = self.path.split("?", 1)[0]
        if path.endswith("/") and path != "/":
            target = path.rstrip("/")
            berkas = os.path.join(ROOT, target.lstrip("/")) + ".html"
            if os.path.isfile(berkas):
                kueri = "?" + self.path.split("?", 1)[1] if "?" in self.path else ""
                self.send_response(301)
                self.send_header("Location", target + kueri)
                self.end_headers()
                return True
        return False

    def do_GET(self):
        if not self._alihkan_tanpa_slash():
            super().do_GET()

    def do_HEAD(self):
        if not self._alihkan_tanpa_slash():
            super().do_HEAD()

    def end_headers(self):
        # Jangan cache saat pengembangan agar perubahan CSS/JS langsung terlihat
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = ThreadingHTTPServer(("0.0.0.0", port), PrettyURLHandler)

    print("Koteshu Indonesia — server lokal")
    print(f"  Beranda : http://localhost:{port}/")
    print(f"  Promo   : http://localhost:{port}/promo")
    print(f"  Admin   : http://localhost:{port}/admin")
    print("  Ctrl+C untuk berhenti.")
    print()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer dihentikan.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
