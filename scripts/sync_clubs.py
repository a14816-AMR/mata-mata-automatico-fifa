"""Regenera backend/clubs_data.py a partir de shared/clubs.json."""
import json
import pprint
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
clubs = json.loads((ROOT / "shared" / "clubs.json").read_text(encoding="utf-8"))
keep = [{k: c[k] for k in ("id", "name", "short", "colors")} for c in clubs]
header = (
    '"""Lista fixa dos 30 clubes (gerada a partir de shared/clubs.json).\n\n'
    "Está em Python, e não em JSON, para ser sempre incluída na função serverless.\n"
    'Se alterar shared/clubs.json, execute: python scripts/sync_clubs.py\n"""\n\n'
)
(ROOT / "backend" / "clubs_data.py").write_text(
    header + "CLUBS = " + pprint.pformat(keep, width=110, sort_dicts=False) + "\n", encoding="utf-8"
)
print(f"{len(keep)} clubes escritos em backend/clubs_data.py")
