import json
from pathlib import Path

from backend.clubs import CLUBS


def test_clubs_data_in_sync_with_shared_json():
    shared = json.loads((Path(__file__).resolve().parents[2] / "shared" / "clubs.json").read_text(encoding="utf-8"))
    assert len(CLUBS) == 30
    assert [(c["id"], c["name"]) for c in CLUBS] == [(c["id"], c["name"]) for c in shared]
