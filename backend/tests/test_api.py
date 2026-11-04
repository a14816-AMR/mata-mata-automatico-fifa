"""Fluxo completo pela API, com uma base de dados em memória que imita o PostgREST."""
import itertools
import uuid

import pytest
from fastapi.testclient import TestClient

from backend import config
from backend.main import app, get_service
from backend.service import TournamentService

_DEFAULTS = {
    "tournaments": {"status": "setup", "team_count": 0, "bracket_size": None},
    "teams": {"sort_order": 0},
    "matches": {"had_penalties": False, "status": "pending", "live": False},
}


class FakeDB:
    def __init__(self):
        self.tables = {t: [] for t in _DEFAULTS}
        self._clock = itertools.count()

    @staticmethod
    def _filter(rows, params):
        out = list(rows)
        for key, value in params.items():
            if key in ("select", "order", "limit", "on_conflict"):
                continue
            op, _, raw = value.partition(".")
            assert op in ("eq", "in")
            if op == "in":
                wanted = set(raw.strip("()").split(","))
                out = [r for r in out if str(r.get(key)) in wanted]
            else:
                out = [r for r in out if str(r.get(key)) == raw]
        if "order" in params:
            for part in reversed(params["order"].split(",")):
                col, _, direction = part.partition(".")
                out.sort(key=lambda r: r.get(col), reverse=direction == "desc")
        if "limit" in params:
            out = out[: int(params["limit"])]
        return out

    def select(self, table, params):
        return [dict(r) for r in self._filter(self.tables[table], params)]

    def insert(self, table, rows):
        rows = rows if isinstance(rows, list) else [rows]
        created = []
        for r in rows:
            row = {**_DEFAULTS[table], "id": str(uuid.uuid4()), "created_at": next(self._clock), **r}
            self.tables[table].append(row)
            created.append(dict(row))
        return created

    def update(self, table, filters, values):
        rows = self._filter(self.tables[table], filters)
        for r in rows:
            r.update(values)
        return [dict(r) for r in rows]

    def upsert(self, table, rows, on_conflict="id"):
        by_id = {r["id"]: r for r in self.tables[table]}
        for r in rows:
            by_id[r["id"]].update(r)
        return rows

    def delete(self, table, filters):
        doomed = {id(r) for r in self._filter(self.tables[table], filters)}
        self.tables[table] = [r for r in self.tables[table] if id(r) not in doomed]
        if table == "tournaments":  # on delete cascade
            alive = {t["id"] for t in self.tables["tournaments"]}
            for child in ("teams", "matches"):
                self.tables[child] = [r for r in self.tables[child] if r["tournament_id"] in alive]


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("ADMIN_PASSWORD", "segredo")
    monkeypatch.setenv("ADMIN_TOKEN_SECRET", "chave-de-teste")
    config.get_settings.cache_clear()
    db = FakeDB()
    app.dependency_overrides[get_service] = lambda: TournamentService(db)
    c = TestClient(app)
    token = c.post("/api/auth/login", json={"password": "segredo"}).json()["token"]
    c.headers["Authorization"] = f"Bearer {token}"
    yield c
    app.dependency_overrides.clear()
    config.get_settings.cache_clear()


CLUB_IDS = [c["id"] for c in TestClient(app).get("/api/clubs").json()]


def test_auth_required(monkeypatch):
    monkeypatch.setenv("ADMIN_PASSWORD", "segredo")
    monkeypatch.setenv("ADMIN_TOKEN_SECRET", "x")
    config.get_settings.cache_clear()
    c = TestClient(app)
    assert c.post("/api/tournaments", json={"name": "X"}).status_code == 401
    assert c.post("/api/auth/login", json={"password": "errada"}).status_code == 401
    config.get_settings.cache_clear()


def test_clubs_list():
    assert len(CLUB_IDS) == 30


def test_full_flow_18_teams(client):
    st = client.post("/api/tournaments", json={"name": "Taça do Escritório"}).json()
    tid = st["tournament"]["id"]

    # clube repetido é rejeitado
    dup = [{"name": "A", "club_id": "porto"}, {"name": "B", "club_id": "porto"}]
    r = client.put(f"/api/tournaments/{tid}/teams", json={"teams": dup})
    assert r.status_code == 400 and "clube" in r.json()["detail"]

    # clube inexistente é rejeitado
    r = client.put(f"/api/tournaments/{tid}/teams", json={"teams": [{"name": "A", "club_id": "portugal"}]})
    assert r.status_code == 400

    teams = [{"name": f"Dupla {i + 1}", "club_id": CLUB_IDS[i]} for i in range(18)]
    st = client.put(f"/api/tournaments/{tid}/teams", json={"teams": teams}).json()
    assert len(st["teams"]) == 18

    st = client.post(f"/api/tournaments/{tid}/bracket").json()
    assert st["tournament"]["status"] == "draft"
    assert st["tournament"]["bracket_size"] == 32
    assert st["rounds"][0]["name"] == "Dezasseis-avos de final"
    assert len(st["matches"]) == 31

    ids = [t["id"] for t in st["teams"]]
    # não pode iniciar sem colocar as duplas
    assert client.post(f"/api/tournaments/{tid}/start").status_code == 400

    # o administrador escolhe: 2 jogos reais e 14 BYE
    slots = [
        {"position": 0, "team1_id": ids[0], "team2_id": ids[1]},
        {"position": 1, "team1_id": ids[2], "team2_id": ids[3]},
    ] + [{"position": p, "team1_id": ids[p + 2], "team2_id": None} for p in range(2, 16)]
    # dupla repetida é rejeitada
    bad = [dict(s) for s in slots]
    bad[1]["team2_id"] = ids[0]
    assert client.put(f"/api/tournaments/{tid}/layout", json={"slots": bad}).status_code == 400

    st = client.put(f"/api/tournaments/{tid}/layout", json={"slots": slots}).json()
    st = client.post(f"/api/tournaments/{tid}/start").json()
    assert st["tournament"]["status"] == "in_progress"
    r1 = [m for m in st["matches"] if m["round"] == 1]
    assert sum(m["status"] == "bye" for m in r1) == 14

    # depois de iniciado não se mexe nas posições
    assert client.put(f"/api/tournaments/{tid}/layout", json={"slots": slots}).status_code == 400

    # empate sem penáltis é rejeitado
    m0 = r1[0]["id"]
    r = client.put(f"/api/matches/{m0}/result", json={"score1": 1, "score2": 1})
    assert r.status_code == 400

    # jogar tudo: equipa 1 vence sempre, com penáltis no primeiro jogo
    client.put(
        f"/api/matches/{m0}/result",
        json={"score1": 1, "score2": 1, "had_penalties": True, "pen1": 5, "pen2": 4},
    )
    for rnd in range(1, 6):
        st = client.get("/api/state").json()
        for m in [m for m in st["matches"] if m["round"] == rnd and m["status"] == "pending"]:
            r = client.put(f"/api/matches/{m['id']}/result", json={"score1": 2, "score2": 0})
            assert r.status_code == 200, r.json()

    st = client.get("/api/state").json()
    assert st["tournament"]["status"] == "finished"
    assert st["champion_id"] == ids[0]
    first = next(m for m in st["matches"] if m["id"] == m0)
    assert (first["score1"], first["pen1"], first["pen2"]) == (1, 5, 4)

    # mudar o vencedor do primeiro jogo anula o percurso seguinte
    st = client.put(f"/api/matches/{m0}/result", json={"score1": 0, "score2": 3}).json()
    assert st["tournament"]["status"] == "in_progress"
    assert st["champion_id"] is None

    # reiniciar volta ao rascunho mantendo a colocação
    st = client.post(f"/api/tournaments/{tid}/reset").json()
    assert st["tournament"]["status"] == "draft"
    assert next(m for m in st["matches"] if m["id"] == m0)["team1_id"] == ids[0]


def test_team_players_saved_and_edited(client):
    tid = client.post("/api/tournaments", json={"name": "Taça"}).json()["tournament"]["id"]
    teams = [
        {"name": "Dupla A", "club_id": CLUB_IDS[0], "players": "  João,   Pedro "},
        {"name": "Dupla B", "club_id": CLUB_IDS[1]},  # jogadores são opcionais
    ]
    st = client.put(f"/api/tournaments/{tid}/teams", json={"teams": teams}).json()
    by_name = {t["name"]: t for t in st["teams"]}
    assert by_name["Dupla A"]["players"] == "João, Pedro"
    assert by_name["Dupla B"]["players"] == ""

    # guardar de novo substitui a lista (as antigas são apagadas, sem duplicados)
    st = client.put(f"/api/tournaments/{tid}/teams", json={"teams": teams}).json()
    assert len(st["teams"]) == 2

    # editar uma dupla continua possível depois de gerar o chaveamento
    client.post(f"/api/tournaments/{tid}/bracket")
    team_id = next(t["id"] for t in st["teams"] if t["name"] == "Dupla B")
    r = client.patch(
        f"/api/tournaments/{tid}/teams/{team_id}",
        json={"name": "Dupla B2", "club_id": CLUB_IDS[1], "players": "Ana, Rita"},
    )
    assert r.status_code == 200
    edited = next(t for t in r.json()["teams"] if t["id"] == team_id)
    assert edited["name"] == "Dupla B2" and edited["players"] == "Ana, Rita"

    # nome repetido é rejeitado na edição
    r = client.patch(
        f"/api/tournaments/{tid}/teams/{team_id}",
        json={"name": "dupla a", "club_id": CLUB_IDS[1]},
    )
    assert r.status_code == 400


def test_match_live_then_final(client):
    tid = client.post("/api/tournaments", json={"name": "Ao vivo"}).json()["tournament"]["id"]
    teams = [{"name": f"D{i}", "club_id": CLUB_IDS[i]} for i in range(4)]
    st = client.put(f"/api/tournaments/{tid}/teams", json={"teams": teams}).json()
    ids = [t["id"] for t in st["teams"]]
    client.post(f"/api/tournaments/{tid}/bracket")
    slots = [{"position": 0, "team1_id": ids[0], "team2_id": ids[1]},
             {"position": 1, "team1_id": ids[2], "team2_id": ids[3]}]
    assert client.put(f"/api/tournaments/{tid}/layout", json={"slots": slots}).status_code == 200
    st = client.post(f"/api/tournaments/{tid}/start").json()
    m = next(x for x in st["matches"] if x["round"] == 1 and x["position"] == 0)

    # a decorrer: placar parcial, sem vencedor, sem avançar ninguém
    st = client.put(f"/api/matches/{m['id']}/live", json={"score1": 1, "score2": 0}).json()
    live = next(x for x in st["matches"] if x["id"] == m["id"])
    assert live["live"] is True and live["status"] == "pending" and live["winner_id"] is None
    assert (live["score1"], live["score2"]) == (1, 0)

    # resultado final termina o "a decorrer"
    st = client.put(f"/api/matches/{m['id']}/result", json={"score1": 2, "score2": 0}).json()
    done = next(x for x in st["matches"] if x["id"] == m["id"])
    assert done["live"] is False and done["status"] == "completed"

    # voltar a pôr a decorrer anula o resultado final
    st = client.put(f"/api/matches/{m['id']}/live", json={"score1": 0, "score2": 0}).json()
    again = next(x for x in st["matches"] if x["id"] == m["id"])
    assert again["live"] is True and again["status"] == "pending" and again["winner_id"] is None


def test_live_with_partial_penalties(client):
    tid = client.post("/api/tournaments", json={"name": "Pen"}).json()["tournament"]["id"]
    teams = [{"name": f"D{i}", "club_id": CLUB_IDS[i]} for i in range(4)]
    st = client.put(f"/api/tournaments/{tid}/teams", json={"teams": teams}).json()
    ids = [t["id"] for t in st["teams"]]
    client.post(f"/api/tournaments/{tid}/bracket")
    client.put(f"/api/tournaments/{tid}/layout", json={"slots": [
        {"position": 0, "team1_id": ids[0], "team2_id": ids[1]},
        {"position": 1, "team1_id": ids[2], "team2_id": ids[3]}]})
    st = client.post(f"/api/tournaments/{tid}/start").json()
    m = next(x for x in st["matches"] if x["round"] == 1 and x["position"] == 0)

    st = client.put(f"/api/matches/{m['id']}/live", json={"score1": 1, "score2": 1, "pen1": 2, "pen2": 1}).json()
    cur = next(x for x in st["matches"] if x["id"] == m["id"])
    assert cur["live"] and cur["had_penalties"] and (cur["pen1"], cur["pen2"]) == (2, 1)

    # placar deixa de estar empatado: penáltis parciais são descartados
    st = client.put(f"/api/matches/{m['id']}/live", json={"score1": 2, "score2": 1, "pen1": 2, "pen2": 1}).json()
    cur = next(x for x in st["matches"] if x["id"] == m["id"])
    assert not cur["had_penalties"] and cur["pen1"] is None
