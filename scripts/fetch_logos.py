"""Descarrega os logótipos dos 30 clubes (via Wikipedia) para frontend/public/clubs/<id>.png.

Uso:  python scripts/fetch_logos.py [--force]

Os ficheiros ficam no repositório e são servidos estaticamente pela Vercel.
Se algum logótipo falhar, a aplicação mostra um escudo gerado com as cores do clube.
"""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLUBS = json.loads((ROOT / "shared" / "clubs.json").read_text(encoding="utf-8"))
OUT = ROOT / "frontend" / "public" / "clubs"
UA = {"User-Agent": "fifa-bracket-logo-fetcher/1.0"}
SIZE = 256


def get(url: str, attempts: int = 5) -> bytes:
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=20) as resp:
                return resp.read()
        except urllib.error.HTTPError as exc:
            if exc.code != 429 or attempt == attempts - 1:
                raise
            time.sleep(2 ** attempt * 2)  # respeitar o rate limit da Wikimedia
    raise RuntimeError("unreachable")


def file_url(file_title: str) -> str | None:
    api = (
        "https://en.wikipedia.org/w/api.php?action=query&format=json&prop=imageinfo"
        f"&iiprop=url&iiurlwidth={SIZE}&titles={urllib.parse.quote(file_title)}"
    )
    data = json.loads(get(api))
    for page in data.get("query", {}).get("pages", {}).values():
        info = (page.get("imageinfo") or [{}])[0]
        if info.get("thumburl"):
            return info["thumburl"]
    return None


def logo_url(title: str) -> str | None:
    api = (
        "https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages"
        f"&piprop=thumbnail&pilicense=any&pithumbsize={SIZE}&redirects=1&titles={urllib.parse.quote(title)}"
    )
    data = json.loads(get(api))
    for page in data.get("query", {}).get("pages", {}).values():
        thumb = page.get("thumbnail", {}).get("source")
        if thumb:
            return thumb
    return None


def main() -> int:
    force = "--force" in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)
    failed = []
    for club in CLUBS:
        target = OUT / f"{club['id']}.png"
        if target.exists() and not force:
            print(f"= {club['name']}")
            continue
        try:
            # "wikiFile" força um ficheiro específico quando a imagem principal
            # do artigo não é o emblema do clube.
            url = file_url(club["wikiFile"]) if club.get("wikiFile") else logo_url(club["wiki"])
            if not url:
                raise RuntimeError("sem imagem")
            target.write_bytes(get(url))
            print(f"+ {club['name']}")
            time.sleep(1.5)
        except Exception as exc:  # noqa: BLE001
            failed.append(club["name"])
            print(f"! {club['name']}: {exc}")
    if failed:
        print(f"\nFalharam {len(failed)}: {', '.join(failed)}")
        return 1
    print("\nTodos os logótipos foram descarregados.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
