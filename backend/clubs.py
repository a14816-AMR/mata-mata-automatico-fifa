import json
from pathlib import Path

_PATH = Path(__file__).resolve().parent.parent / "shared" / "clubs.json"

CLUBS: list[dict] = json.loads(_PATH.read_text(encoding="utf-8"))
CLUB_IDS: set[str] = {c["id"] for c in CLUBS}
