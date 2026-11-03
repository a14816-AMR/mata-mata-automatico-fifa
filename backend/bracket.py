"""Lógica pura do mata-mata (sem I/O), para poder ser testada isoladamente.

Modelo:
- O chaveamento tem `size` lugares (potência de 2 ≥ nº de duplas).
- A ronda 1 tem size/2 partidas; a ronda r tem size/2**r partidas; a última é a final.
- O vencedor de (round, position) avança para (round+1, position//2),
  ocupando team1 se `position` for par e team2 se for ímpar.
- Um confronto da ronda 1 com apenas uma dupla é um BYE (passagem direta).
  Os BYE nunca são atribuídos automaticamente: resultam da colocação feita
  pelo administrador no drag & drop.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable

Match = dict[str, Any]

RESULT_FIELDS = ("score1", "score2", "pen1", "pen2")

ROUND_NAMES = {
    2: "Final",
    4: "Meias-finais",
    8: "Quartos de final",
    16: "Oitavos de final",
    32: "Dezasseis-avos de final",
    64: "Trinta e dois avos de final",
    128: "Sessenta e quatro avos de final",
}


class BracketError(ValueError):
    """Erro de regra de negócio, com mensagem pronta a mostrar ao utilizador."""


def bracket_size_for(team_count: int) -> int:
    if team_count < 2:
        raise BracketError("São necessárias pelo menos 2 duplas.")
    size = 2
    while size < team_count:
        size *= 2
    return size


def total_rounds(size: int) -> int:
    return size.bit_length() - 1


def round_name(round_no: int, size: int) -> str:
    teams_in_round = size // (2 ** (round_no - 1))
    return ROUND_NAMES.get(teams_in_round, f"Ronda de {teams_in_round}")


def bye_count(team_count: int) -> int:
    return bracket_size_for(team_count) - team_count


def empty_structure(size: int) -> list[Match]:
    """Todas as partidas de todas as fases, vazias."""
    matches: list[Match] = []
    for r in range(1, total_rounds(size) + 1):
        for p in range(size // (2**r)):
            matches.append(
                {
                    "round": r,
                    "position": p,
                    "team1_id": None,
                    "team2_id": None,
                    "score1": None,
                    "score2": None,
                    "had_penalties": False,
                    "pen1": None,
                    "pen2": None,
                    "winner_id": None,
                    "status": "pending",
                }
            )
    return matches


def next_target(round_no: int, position: int, rounds: int) -> tuple[int, int, str] | None:
    if round_no >= rounds:
        return None
    return round_no + 1, position // 2, "team1_id" if position % 2 == 0 else "team2_id"


# ---------------------------------------------------------------------------
# Validação da colocação inicial (drag & drop)
# ---------------------------------------------------------------------------
def validate_partial_layout(first_round: Iterable[Match], team_ids: set[str]) -> None:
    """Regras que valem mesmo durante a edição (rascunho)."""
    seen: set[str] = set()
    for m in first_round:
        for slot in ("team1_id", "team2_id"):
            tid = m.get(slot)
            if tid is None:
                continue
            if tid not in team_ids:
                raise BracketError("Foi colocada uma dupla que não pertence a este torneio.")
            if tid in seen:
                raise BracketError("Uma dupla não pode estar em dois confrontos ao mesmo tempo.")
            seen.add(tid)


def validate_complete_layout(first_round: list[Match], team_ids: set[str]) -> None:
    """Regras para poder iniciar o torneio."""
    validate_partial_layout(first_round, team_ids)
    placed = {m[s] for m in first_round for s in ("team1_id", "team2_id") if m.get(s)}
    missing = len(team_ids - placed)
    if missing:
        raise BracketError(
            f"Faltam colocar {missing} dupla(s) no chaveamento."
            if missing > 1
            else "Falta colocar 1 dupla no chaveamento."
        )
    for m in sorted(first_round, key=lambda x: x["position"]):
        if not m.get("team1_id") and not m.get("team2_id"):
            raise BracketError(
                f"O confronto {m['position'] + 1} está vazio. Cada confronto precisa de pelo "
                "menos uma dupla (uma dupla sozinha recebe BYE)."
            )


# ---------------------------------------------------------------------------
# Resultados
# ---------------------------------------------------------------------------
@dataclass
class Result:
    score1: int
    score2: int
    had_penalties: bool = False
    pen1: int | None = None
    pen2: int | None = None


def _check_score(value: Any, label: str) -> int:
    if value is None or isinstance(value, bool) or not isinstance(value, int):
        raise BracketError(f"Indique {label}.")
    if value < 0 or value > 99:
        raise BracketError(f"{label[0].upper() + label[1:]} tem de estar entre 0 e 99.")
    return value


def decide_winner(team1: str, team2: str, result: Result) -> str:
    s1 = _check_score(result.score1, "os golos da primeira dupla")
    s2 = _check_score(result.score2, "os golos da segunda dupla")
    if not result.had_penalties:
        if s1 == s2:
            raise BracketError(
                "A partida está empatada: indique o resultado da disputa de penáltis."
            )
        return team1 if s1 > s2 else team2
    if s1 != s2:
        raise BracketError("Só pode haver disputa de penáltis quando o resultado está empatado.")
    p1 = _check_score(result.pen1, "os penáltis da primeira dupla")
    p2 = _check_score(result.pen2, "os penáltis da segunda dupla")
    if p1 == p2:
        raise BracketError("A disputa de penáltis não pode terminar empatada.")
    return team1 if p1 > p2 else team2


# ---------------------------------------------------------------------------
# Motor de propagação
# ---------------------------------------------------------------------------
class BracketEngine:
    """Aplica operações sobre as partidas de um torneio, em memória.

    Regista as partidas alteradas para depois serem gravadas de uma só vez.
    """

    def __init__(self, matches: list[Match], size: int):
        self.size = size
        self.rounds = total_rounds(size)
        self.by_key: dict[tuple[int, int], Match] = {(m["round"], m["position"]): m for m in matches}
        self.by_id: dict[str, Match] = {m["id"]: m for m in matches if m.get("id")}
        self._changed: dict[tuple[int, int], Match] = {}

    # -- utilitários -------------------------------------------------------
    def _mark(self, m: Match) -> None:
        self._changed[(m["round"], m["position"])] = m

    def changed(self) -> list[Match]:
        return list(self._changed.values())

    def first_round(self) -> list[Match]:
        return sorted((m for (r, _), m in self.by_key.items() if r == 1), key=lambda m: m["position"])

    def final(self) -> Match:
        return self.by_key[(self.rounds, 0)]

    def champion(self) -> str | None:
        f = self.final()
        return f["winner_id"] if f["status"] == "completed" else None

    @staticmethod
    def _wipe_result(m: Match) -> None:
        m.update(score1=None, score2=None, had_penalties=False, pen1=None, pen2=None)

    # -- propagação --------------------------------------------------------
    def _assign(self, round_no: int, position: int, team_id: str | None) -> None:
        """Coloca o vencedor de (round_no, position) no lugar seguinte."""
        target = next_target(round_no, position, self.rounds)
        if target is None:
            return
        r, p, slot = target
        nxt = self.by_key[(r, p)]
        if nxt[slot] == team_id:
            return
        nxt[slot] = team_id
        self._mark(nxt)
        # Os participantes mudaram: um resultado já existente deixa de ser válido.
        if nxt["status"] == "completed" or nxt["winner_id"] is not None:
            self._reset(nxt)

    def _reset(self, m: Match) -> None:
        had_winner = m["winner_id"] is not None
        self._wipe_result(m)
        m["winner_id"] = None
        m["status"] = "pending"
        self._mark(m)
        if had_winner:
            self._assign(m["round"], m["position"], None)

    # -- operações ---------------------------------------------------------
    def start(self) -> None:
        """Resolve os BYE da ronda 1 e coloca essas duplas na fase seguinte."""
        for m in self.first_round():
            teams = [t for t in (m["team1_id"], m["team2_id"]) if t]
            if len(teams) == 1:
                self._wipe_result(m)
                m["winner_id"] = teams[0]
                m["status"] = "bye"
                self._mark(m)
                self._assign(1, m["position"], teams[0])

    def reset_all(self) -> None:
        """Volta ao rascunho: apaga resultados e fases seguintes, mantém a ronda 1."""
        for (r, _), m in self.by_key.items():
            self._wipe_result(m)
            m["winner_id"] = None
            m["status"] = "pending"
            if r > 1:
                m["team1_id"] = None
                m["team2_id"] = None
            self._mark(m)

    def set_result(self, match_id: str, result: Result) -> Match:
        m = self._get(match_id)
        if m["status"] == "bye":
            raise BracketError("Esta dupla passou com BYE: não há partida para registar.")
        if not m["team1_id"] or not m["team2_id"]:
            raise BracketError("Ainda não se conhecem as duas duplas deste confronto.")
        winner = decide_winner(m["team1_id"], m["team2_id"], result)
        m.update(
            score1=result.score1,
            score2=result.score2,
            had_penalties=result.had_penalties,
            pen1=result.pen1 if result.had_penalties else None,
            pen2=result.pen2 if result.had_penalties else None,
            winner_id=winner,
            status="completed",
        )
        self._mark(m)
        self._assign(m["round"], m["position"], winner)
        return m

    def clear_result(self, match_id: str) -> Match:
        m = self._get(match_id)
        if m["status"] == "bye":
            raise BracketError("Não é possível apagar um BYE depois de o torneio começar.")
        self._reset(m)
        return m

    def _get(self, match_id: str) -> Match:
        try:
            return self.by_id[match_id]
        except KeyError as exc:
            raise BracketError("Partida não encontrada.") from exc
