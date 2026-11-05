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
from .clubs import CLUB_IDS
from .db import MissingColumnError

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


def _masked(m: dict) -> dict:
    """Partida sem duplas nem resultado, para um chaveamento ainda não publicado."""
    return {
        "id": m["id"],
        "tournament_id": m["tournament_id"],
        "round": m["round"],
        "position": m["position"],
        "team1_id": None,
        "team2_id": None,
        "score1": None,
        "score2": None,
        "had_penalties": False,
        "pen1": None,
        "pen2": None,
        "winner_id": None,
        "status": "pending",
        "live": False,
    }


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

    def state(self, tid: str | None = None, *, public: bool = False) -> dict:
        """Estado completo. Com ``public=True`` (visitantes), um chaveamento ainda
        não publicado é mascarado: o público vê a estrutura (fases e caixas), mas
        nenhuma dupla (nome, jogadores, clube), resultado ou BYE — todas as caixas
        ficam "A definir"."""
        t = self._tournament(tid) if tid else self._latest()
        if t is None:
            return {"tournament": None, "teams": [], "matches": [], "rounds": [], "champion_id": None}
        # Sem a migração 003 a coluna não existe: comporta-se como antes (visível).
        t.setdefault("bracket_public", True)
        hidden = public and not t["bracket_public"]
        # Oculto: nem nomes das duplas, nem jogadores, nem clubes chegam ao público.
        teams = [] if hidden else self._teams(t["id"])
        return self._build_state(t, teams, self._matches(t["id"]), hidden=hidden)

    @staticmethod
    def _build_state(t: dict, teams: list[dict], matches: list[dict], *, hidden: bool = False) -> dict:
        """Monta o estado a partir de linhas já lidas (evita voltar à base de dados)."""
        t.setdefault("bracket_public", True)
        if hidden:
            matches = [_masked(m) for m in matches]
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
            "teams": [] if hidden else teams,
            "matches": matches,
            "rounds": rounds,
            "champion_id": None if hidden else champion,
            "bracket_hidden": hidden,
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
        # Qualquer alteração feita pelo motor (resultado, reinício, propagação)
        # termina o estado "a decorrer" dessa partida.
        base = [{k: r.get(k) for k in MATCH_COLUMNS} for r in rows]
        try:
            self.db.upsert("matches", [{**r, "live": False} for r in base])
        except MissingColumnError as exc:
            # Migração 002 por executar: os resultados continuam a funcionar,
            # só o modo "a decorrer" fica indisponível.
            if "'live'" not in str(exc):
                raise
            self.db.upsert("matches", base)

    # ------------------------------------------------------------- torneio
    def create(self, name: str) -> dict:
        row = {"name": name.strip(), "status": "setup"}
        try:
            # Torneios novos começam com o chaveamento oculto ao público.
            t = self.db.insert("tournaments", {**row, "bracket_public": False})[0]
        except MissingColumnError:
            t = self.db.insert("tournaments", row)[0]
        return self.state(t["id"])

    def set_bracket_public(self, tid: str, visible: bool) -> dict:
        """Mostra ou oculta o chaveamento na página pública (em qualquer fase)."""
        self._tournament(tid)
        self._set_status(tid, bracket_public=visible)
        return self.state(tid)

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
        for i, team in enumerate(teams, start=1):
            name = " ".join(team["name"].split())
            club = team["club_id"]
            if not name:
                raise BracketError(f"A dupla {i} não tem nome.")
            if name.casefold() in names:
                raise BracketError(f"Existem duas duplas com o nome «{name}».")
            if club not in CLUB_IDS:
                raise BracketError(f"Escolha um clube válido para a dupla «{name}».")
            names.add(name.casefold())
            players = " ".join(str(team.get("players") or "").split())
            cleaned.append({"tournament_id": tid, "name": name, "club_id": club, "players": players, "sort_order": i})
        # Insere primeiro e só depois apaga as antigas: se a inserção falhar,
        # as duplas existentes continuam intactas.
        old_ids = [t["id"] for t in self._teams(tid)]
        self.db.insert("teams", cleaned)
        if old_ids:
            self.db.delete("teams", {"id": f"in.({','.join(old_ids)})"})
        self._set_status(tid, team_count=len(cleaned))
        return self.state(tid)

    def update_team(self, tid: str, team_id: str, name: str, club: str, players: str = "") -> dict:
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
        players = " ".join(players.split())
        self.db.update("teams", {"id": f"eq.{team_id}"}, {"name": name, "club_id": club, "players": players})
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
        teams = self._teams(tid)
        team_ids = {tm["id"] for tm in teams}
        matches = self._matches(tid)
        first = {m["position"]: m for m in matches if m["round"] == 1}
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
        for m in changed:
            m["live"] = False
        # As linhas em memória já refletem a gravação: devolve o estado sem novas leituras.
        return self._build_state(t, teams, matches)

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

    def set_live(
        self, match_id: str, score1: int, score2: int, pen1: int | None = None, pen2: int | None = None
    ) -> dict:
        """Marca a partida como a decorrer, com o placar parcial (sem vencedor)."""
        t, engine = self._match_context(match_id)
        m = engine.by_id.get(match_id)
        if m is None:
            raise NotFound("Partida não encontrada.")
        if m["status"] == "bye":
            raise BracketError("Esta dupla passou com BYE: não há partida a decorrer.")
        if not m["team1_id"] or not m["team2_id"]:
            raise BracketError("Ainda não se conhecem as duas duplas deste confronto.")
        if m["status"] == "completed":
            # Volta a estar em jogo: o resultado final (e o que dele dependia) é anulado.
            engine.clear_result(match_id)
            self._commit(t, engine)
        # Penáltis parciais só fazem sentido com o jogo empatado.
        shootout = score1 == score2 and pen1 is not None and pen2 is not None
        self.db.update(
            "matches",
            {"id": f"eq.{match_id}"},
            {"live": True, "score1": score1, "score2": score2,
             "had_penalties": shootout, "pen1": pen1 if shootout else None,
             "pen2": pen2 if shootout else None},
        )
        return self.state(t["id"])

    def clear_result(self, match_id: str) -> dict:
        t, engine = self._match_context(match_id)
        engine.clear_result(match_id)
        return self._commit(t, engine)
