from .clubs_data import CLUBS

CLUB_IDS: set[str] = {c["id"] for c in CLUBS}
