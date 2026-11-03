import itertools

import pytest

from backend.bracket import (
    BracketEngine,
    BracketError,
    Result,
    bracket_size_for,
    bye_count,
    decide_winner,
    empty_structure,
    round_name,
    validate_complete_layout,
    validate_partial_layout,
)


def build(team_count, layout=None):
    """Cria partidas com ids e coloca as duplas na ronda 1."""
    size = bracket_size_for(team_count)
    matches = empty_structure(size)
    ids = itertools.count()
    for m in matches:
        m["id"] = f"m{next(ids)}"
    teams = [f"t{i}" for i in range(team_count)]
    r1 = sorted((m for m in matches if m["round"] == 1), key=lambda m: m["position"])
    if layout is None:
        # Preenche os 1.º lugares de todos os confrontos e depois os 2.º lugares.
        slots = [(m, "team1_id") for m in r1] + [(m, "team2_id") for m in r1]
        for (m, slot), t in zip(slots, teams):
            m[slot] = t
    else:
        for m, (a, b) in zip(r1, layout):
            m["team1_id"], m["team2_id"] = a, b
    return matches, size, teams


def find(matches, r, p):
    return next(m for m in matches if m["round"] == r and m["position"] == p)


def test_sizes_and_names():
    assert bracket_size_for(2) == 2
    assert bracket_size_for(16) == 16
    assert bracket_size_for(18) == 32
    assert bye_count(18) == 14
    assert bye_count(16) == 0
    assert round_name(1, 32) == "Dezasseis-avos de final"
    assert round_name(2, 32) == "Oitavos de final"
    assert round_name(5, 32) == "Final"
    assert round_name(1, 4) == "Meias-finais"
    with pytest.raises(BracketError):
        bracket_size_for(1)


def test_structure_counts():
    matches = empty_structure(32)
    assert len(matches) == 31
    assert sum(1 for m in matches if m["round"] == 1) == 16


def test_decide_winner_rules():
    assert decide_winner("a", "b", Result(2, 1)) == "a"
    assert decide_winner("a", "b", Result(0, 3)) == "b"
    assert decide_winner("a", "b", Result(1, 1, True, 3, 4)) == "b"
    with pytest.raises(BracketError, match="empatada"):
        decide_winner("a", "b", Result(1, 1))
    with pytest.raises(BracketError, match="empatado"):
        decide_winner("a", "b", Result(2, 1, True, 3, 4))
    with pytest.raises(BracketError, match="penáltis não pode"):
        decide_winner("a", "b", Result(1, 1, True, 4, 4))
    with pytest.raises(BracketError):
        decide_winner("a", "b", Result(1, 1, True, None, 2))
    with pytest.raises(BracketError):
        decide_winner("a", "b", Result(-1, 2))


def test_layout_validation():
    matches, size, teams = build(18)
    r1 = [m for m in matches if m["round"] == 1]
    validate_complete_layout(r1, set(teams))

    # dupla em falta
    r1[0]["team1_id"] = None
    with pytest.raises(BracketError, match="Falta"):
        validate_complete_layout(r1, set(teams))

    # dupla repetida
    r1[0]["team1_id"] = r1[1]["team1_id"]
    with pytest.raises(BracketError, match="dois confrontos"):
        validate_partial_layout(r1, set(teams))

    # confronto vazio
    matches, size, teams = build(3, layout=[("t0", "t1"), ("t2", None)])
    r1 = [m for m in matches if m["round"] == 1]
    validate_complete_layout(r1, set(teams))
    matches, size, teams = build(3, layout=[(None, None), ("t2", None)])
    r1 = [m for m in matches if m["round"] == 1]
    with pytest.raises(BracketError):
        validate_complete_layout(r1, set(teams))


def test_byes_are_chosen_by_layout_and_advance():
    # 18 duplas: 2 confrontos reais + 14 BYE escolhidos pelo administrador.
    layout = [("t0", "t1"), ("t2", "t3")] + [(f"t{i}", None) for i in range(4, 18)]
    matches, size, teams = build(18, layout)
    eng = BracketEngine(matches, size)
    eng.start()
    assert find(matches, 1, 0)["status"] == "pending"
    assert find(matches, 1, 2)["status"] == "bye"
    assert find(matches, 1, 2)["winner_id"] == "t4"
    # BYE do confronto 3 (pos 2) e 4 (pos 3) encontram-se nos oitavos (pos 1)
    assert find(matches, 2, 1)["team1_id"] == "t4"
    assert find(matches, 2, 1)["team2_id"] == "t5"
    # o oitavo 0 espera pelos vencedores dos confrontos 0 e 1
    assert find(matches, 2, 0)["team1_id"] is None


def test_full_tournament_and_champion():
    matches, size, teams = build(8)
    eng = BracketEngine(matches, size)
    eng.start()
    for r in range(1, 4):
        for m in sorted((m for m in matches if m["round"] == r), key=lambda m: m["position"]):
            eng.set_result(m["id"], Result(2, 0))
    assert eng.champion() == "t0"


def test_penalties_decide_and_keep_score():
    matches, size, teams = build(2)
    eng = BracketEngine(matches, size)
    eng.start()
    m = eng.set_result("m0", Result(2, 2, True, 3, 5))
    assert m["winner_id"] == "t1"
    assert (m["score1"], m["score2"], m["pen1"], m["pen2"]) == (2, 2, 3, 5)
    assert eng.champion() == "t1"


def test_changing_result_cascades_downstream():
    matches, size, teams = build(4, layout=[("a", "b"), ("c", "d")])
    eng = BracketEngine(matches, size)
    eng.start()
    sf0, sf1 = find(matches, 1, 0), find(matches, 1, 1)
    eng.set_result(sf0["id"], Result(1, 0))
    eng.set_result(sf1["id"], Result(1, 0))
    final = find(matches, 2, 0)
    eng.set_result(final["id"], Result(3, 1))
    assert eng.champion() == "a"

    # mesmo vencedor com outro marcador: final mantém-se
    eng.set_result(sf0["id"], Result(4, 0))
    assert final["status"] == "completed"

    # vencedor muda: final é anulada e o novo vencedor ocupa o lugar
    eng.set_result(sf0["id"], Result(0, 1))
    assert final["team1_id"] == "b"
    assert final["status"] == "pending"
    assert final["score1"] is None
    assert eng.champion() is None


def test_clear_result_removes_from_next_round():
    matches, size, teams = build(4, layout=[("a", "b"), ("c", "d")])
    eng = BracketEngine(matches, size)
    eng.start()
    sf0 = find(matches, 1, 0)
    eng.set_result(sf0["id"], Result(1, 0))
    assert find(matches, 2, 0)["team1_id"] == "a"
    eng.clear_result(sf0["id"])
    assert find(matches, 2, 0)["team1_id"] is None
    assert sf0["status"] == "pending"


def test_cannot_play_bye_or_incomplete_match():
    matches, size, teams = build(3, layout=[("a", "b"), ("c", None)])
    eng = BracketEngine(matches, size)
    eng.start()
    with pytest.raises(BracketError, match="BYE"):
        eng.set_result(find(matches, 1, 1)["id"], Result(1, 0))
    with pytest.raises(BracketError, match="duas duplas"):
        eng.set_result(find(matches, 2, 0)["id"], Result(1, 0))


def test_reset_all_keeps_first_round():
    matches, size, teams = build(4, layout=[("a", "b"), ("c", "d")])
    eng = BracketEngine(matches, size)
    eng.start()
    eng.set_result(find(matches, 1, 0)["id"], Result(1, 0))
    eng.reset_all()
    assert find(matches, 1, 0)["team1_id"] == "a"
    assert find(matches, 1, 0)["status"] == "pending"
    assert find(matches, 2, 0)["team1_id"] is None
