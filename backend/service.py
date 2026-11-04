"""Operações do torneio: combinam a lógica pura (bracket.py) com a persistência (Supabase)."""
from __future__ import annotations

from typing import Any

from .bracket import (
    BracketEngine,
    BracketError,
    Result,
    bracket_size_for,
    empty_structure,
    round_name,
    total_rounds,
    validate_complete_layout,
    validate_partial_layout,
)
from .clubs import CLUB_IDS, CLUBS

MATCH_COLUMNS = (
    "id",
    "tournament_id",
    "round",
    "position",
    "team1_id",
    "team2_id",
    "score1",
    "score2",
    "had_penalties",
    "pen1",
    "pen2",
    "winner_id",
    "status",
)

STATUS_LABELS = {
    "setup": "registo de duplas",
    "draft": "organização dos confrontos",
    "in_progress": "torneio em curso",
    "finished": "torneio terminado",
}


class NotFound(LookupError):
    pass


class TournamentService:
    def __init__(self, db: Any):
        self.db = db

    # ------------------------------------------------------------------ leitura
    def _tournament(self, tid: str) -> dict:
        rows = self.db.select("tournaments", {"id": f"eq.{tid}"})
        if not rows:
            raise NotFound("Torneio não encontrado.")
        return rows[0]

    def _latest(self) -> dict | None:
        rows = self.db.select("tournaments", {"order": "created_at.desc", "limit": "1"})
        return rows[0] if rows else None

    def _teams(self, tid: str) -> list[dict]:
        return self.db.select(
            "teams", {"tournament_id": f"eq.{tid}", "order": "sort_order.asc"}
        )

    def _matches(self, tid: str) -> list[dict]:
        return self.db.select(
            "matches", {"tournament_id": f"eq.{tid}", "order": "round.asc,position.asc"}
        )

    def state(self, tid: str | None = None) -> dict:
        t = self._tournament(tid) if tid else self._latest()
        if t is None:
            return {"tournament": None, "teams": [], "matches": [], "rounds": [], "champion_id": None}
        matches = self._matches(t["id"])
        rounds = []
        champion = None
        if t.get("bracket_size"):
            size = t["bracket_size"]
            rounds = [
                {"round": r, "name": round_name(r, size)} for r in range(1, total_rounds(size) + 1)
            ]
            final = next((m for m in matches if m["round"] == total_rounds(size)), None)
            if final and final["status"] == "completed":
                champion = final["winner_id"]
        return {
            "tournament": t,
            "teams": self._teams(t["id"]),
            "matches": matches,
            "rounds": rounds,
            "champion_id": champion,
        }

    @staticmethod
    def _require_status(t: dict, *allowed: str) -> None:
        if t["status"] not in allowed:
            raise BracketError(
                f"Operação indisponível na fase atual ({STATUS_LABELS.get(t['status'], t['status'])})."
            )

    def _set_status(self, tid: str, **values: Any) -> None:
        self.db.update("tournaments", {"id": f"eq.{tid}"}, values)

    def _save_matches(self, rows: list[dict]) -> None:
        self.db.upsert("matches", [{k: r.get(k) for k in MATCH_COLUMNS} for r in rows])

    # ------------------------------------------------------------- torneio
    def create(self, name: str) -> dict:
        t = self.db.insert("tournaments", {"name": name.strip(), "status": "setup"})[0]
        return self.state(t["id"])

    def rename(self, tid: str, name: str) -> dict:
        self._tournament(tid)
        self._set_status(tid, name=name.strip())
        return self.state(tid)

    def delete(self, tid: str) -> None:
        self._tournament(tid)
        self.db.delete("tournaments", {"id": f"eq.{tid}"})

    # -------------------------------------------------------------- duplas
    def save_teams(self, tid: str, teams: list[dict]) -> dict:
        t = self._tournament(tid)
        self._require_status(t, "setup")
        cleaned = []
        names: set[str] = set()
        clubs: set[str] = set()
        unique_clubs = len(teams) <= len(CLUBS)
        for i, team in enumerate(teams, start=1):
            name = " ".join(team["name"].split())
            club = team["club_id"]
            if not name:
                raise BracketError(f"A dupla {i} não tem nome.")
            if name.casefold() in names:
                raise BracketError(f"Existem duas duplas com o nome «{name}».")
            if club not in CLUB_IDS:
                raise BracketError(f"Escolha um clube válido para a dupla «{name}».")
            if unique_clubs and club in clubs:
                raise BracketError(f"O clube escolhido por «{name}» já pertence a outra dupla.")
            names.add(name.casefold())
            clubs.add(club)
            cleaned.append({"tournament_id": tid, "name": name, "club_id": club, "sort_order": i})
        self.db.delete("teams", {"tournament_id": f"eq.{tid}"})
        self.db.insert("teams", cleaned)
        self._set_status(tid, team_count=len(cleaned))
        return self.state(tid)

    def update_team(self, tid: str, team_id: str, name: str, club: str) -> dict:
        """Edita nome/clube de uma dupla em qualquer fase do torneio."""
        self._tournament(tid)
        teams = self._teams(tid)
        if not any(t["id"] == team_id for t in teams):
            raise NotFound("Dupla não encontrada.")
        name = " ".join(name.split())
        if not name:
            raise BracketError("A dupla não tem nome.")
        if club not in CLUB_IDS:
            raise BracketError("Escolha um clube válido.")
        for t in teams:
            if t["id"] == team_id:
                continue
            if t["name"].casefold() == name.casefold():
                raise BracketError(f"Já existe uma dupla com o nome «{name}».")
            if len(teams) <= len(CLUBS) and t["club_id"] == club:
                raise BracketError("Esse clube já pertence a outra dupla.")
        self.db.update("teams", {"id": f"eq.{team_id}"}, {"name": name, "club_id": club})
        return self.state(tid)

    # --------------------------------------------------------- chaveamento
    def generate_bracket(self, tid: str) -> dict:
        t = self._tournament(tid)
        self._require_status(t, "setup")
        teams = self._teams(tid)
        size = bracket_size_for(len(teams))
        self.db.delete("matches", {"tournament_id": f"eq.{tid}"})
        rows = [{**m, "tournament_id": tid} for m in empty_structure(size)]
        self.db.insert("matches", rows)
        self._set_status(tid, status="draft", bracket_size=size, team_count=len(teams))
        return self.state(tid)

    def back_to_setup(self, tid: str) -> dict:
        t = self._tournament(tid)
        self._require_status(t, "draft")
        self.db.delete("matches", {"tournament_id": f"eq.{tid}"})
        self._set_status(tid, status="setup", bracket_size=None)
        return self.state(tid)

    def save_layout(self, tid: str, slots: list[dict]) -> dict:
        t = self._tournament(tid)
        self._require_status(t, "draft")
        team_ids = {tm["id"] for tm in self._teams(tid)}
        first = {m["position"]: m for m in self._matches(tid) if m["round"] == 1}
        changed = []
        for slot in slots:
            m = first.get(slot["position"])
            if m is None:
                raise BracketError(f"Confronto {slot['position'] + 1} não existe.")
            if (m["team1_id"], m["team2_id"]) != (slot["team1_id"], slot["team2_id"]):
                m["team1_id"], m["team2_id"] = slot["team1_id"], slot["team2_id"]
                changed.append(m)
        validate_partial_layout(first.values(), team_ids)
        self._save_matches(changed)
        return self.state(tid)

    def start(self, tid: str) -> dict:
        t = self._tournament(tid)
        self._require_status(t, "draft")
        matches = self._matches(tid)
        team_ids = {tm["id"] for tm in self._teams(tid)}
        engine = BracketEngine(matches, t["bracket_size"])
        validate_complete_layout(engine.first_round(), team_ids)
        engine.start()
        self._save_matches(engine.changed())
        self._set_status(tid, status="in_progress")
        return self.state(tid)

    def reset_to_draft(self, tid: str) -> dict:
        t = self._tournament(tid)
        self._require_status(t, "in_progress", "finished")
        engine = BracketEngine(self._matches(tid), t["bracket_size"])
        engine.reset_all()
        self._save_matches(engine.changed())
        self._set_status(tid, status="draft")
        return self.state(tid)

    # ----------------------------------------------------------- resultados
    def _match_context(self, match_id: str) -> tuple[dict, BracketEngine]:
        rows = self.db.select("matches", {"id": f"eq.{match_id}"})
        if not rows:
            raise NotFound("Partida não encontrada.")
        t = self._tournament(rows[0]["tournament_id"])
        self._require_status(t, "in_progress", "finished")
        return t, BracketEngine(self._matches(t["id"]), t["bracket_size"])

    def _commit(self, t: dict, engine: BracketEngine) -> dict:
        self._save_matches(engine.changed())
        status = "finished" if engine.champion() else "in_progress"
        if status != t["status"]:
            self._set_status(t["id"], status=status)
        return self.state(t["id"])

    def set_result(self, match_id: str, result: dict) -> dict:
        t, engine = self._match_context(match_id)
        engine.set_result(match_id, Result(**result))
        return self._commit(t, engine)

    def clear_result(self, match_id: str) -> dict:
        t, engine = self._match_context(match_id)
        engine.clear_result(match_id)
        return self._commit(t, engine)
