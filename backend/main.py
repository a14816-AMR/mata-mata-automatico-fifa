"""API FastAPI do torneio. Todas as rotas vivem em /api."""
from __future__ import annotations

import time

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .auth import check_password, issue_token, require_admin, verify_token
from .bracket import BracketError
from .clubs import CLUBS
from .config import get_settings
from .db import DatabaseError, get_db
from .schemas import LayoutIn, LoginIn, LiveIn, ResultIn, TeamIn, TeamsIn, TournamentIn, VisibilityIn
from .service import NotFound, TournamentService

app = FastAPI(
    title="Torneio EA FC em Duplas",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(BracketError)
async def _bracket_error(_: Request, exc: BracketError):
    return JSONResponse({"detail": str(exc)}, status_code=400)


@app.exception_handler(NotFound)
async def _not_found(_: Request, exc: NotFound):
    return JSONResponse({"detail": str(exc)}, status_code=404)


@app.exception_handler(DatabaseError)
async def _db_error(_: Request, exc: DatabaseError):
    return JSONResponse({"detail": str(exc)}, status_code=502)


def get_service() -> TournamentService:
    return TournamentService(get_db())


public = APIRouter(prefix="/api")
admin = APIRouter(prefix="/api", dependencies=[Depends(require_admin)])


# ----------------------------------------------------------------- público
@public.get("/health")
def health():
    missing = get_settings().missing()
    return {"ok": not missing, "missing_config": missing}


@public.get("/clubs")
def clubs():
    return [{k: c[k] for k in ("id", "name", "short", "colors")} for c in CLUBS]


@public.get("/state")
def state(
    tournament_id: str | None = None,
    authorization: str = Header(default=""),
    svc: TournamentService = Depends(get_service),
):
    # O administrador vê sempre o chaveamento; os visitantes só depois de publicado.
    token = authorization.removeprefix("Bearer ").strip()
    is_admin = bool(token) and verify_token(token)
    return svc.state(tournament_id, public=not is_admin)


@public.post("/auth/login")
def login(body: LoginIn):
    if not check_password(body.password):
        time.sleep(0.8)  # trava tentativas sucessivas
        raise HTTPException(401, "Palavra-passe incorreta.")
    token, expires = issue_token()
    return {"token": token, "expires_at": expires}


# ------------------------------------------------------------ administração
@admin.get("/auth/check")
def auth_check():
    return {"ok": True}


@admin.post("/tournaments")
def create_tournament(body: TournamentIn, svc: TournamentService = Depends(get_service)):
    return svc.create(body.name)


@admin.patch("/tournaments/{tid}")
def rename_tournament(tid: str, body: TournamentIn, svc: TournamentService = Depends(get_service)):
    return svc.rename(tid, body.name)


@admin.delete("/tournaments/{tid}")
def delete_tournament(tid: str, svc: TournamentService = Depends(get_service)):
    svc.delete(tid)
    return svc.state()


@admin.put("/tournaments/{tid}/teams")
def save_teams(tid: str, body: TeamsIn, svc: TournamentService = Depends(get_service)):
    return svc.save_teams(tid, [t.model_dump() for t in body.teams])


@admin.patch("/tournaments/{tid}/teams/{team_id}")
def update_team(tid: str, team_id: str, body: TeamIn, svc: TournamentService = Depends(get_service)):
    return svc.update_team(tid, team_id, body.name, body.club_id, body.players)


@admin.post("/tournaments/{tid}/bracket")
def generate_bracket(tid: str, svc: TournamentService = Depends(get_service)):
    return svc.generate_bracket(tid)


@admin.delete("/tournaments/{tid}/bracket")
def back_to_setup(tid: str, svc: TournamentService = Depends(get_service)):
    return svc.back_to_setup(tid)


@admin.put("/tournaments/{tid}/visibility")
def set_visibility(tid: str, body: VisibilityIn, svc: TournamentService = Depends(get_service)):
    return svc.set_bracket_public(tid, body.bracket_public)


@admin.put("/tournaments/{tid}/layout")
def save_layout(tid: str, body: LayoutIn, svc: TournamentService = Depends(get_service)):
    return svc.save_layout(tid, [s.model_dump() for s in body.slots])


@admin.post("/tournaments/{tid}/start")
def start(tid: str, svc: TournamentService = Depends(get_service)):
    return svc.start(tid)


@admin.post("/tournaments/{tid}/reset")
def reset(tid: str, svc: TournamentService = Depends(get_service)):
    return svc.reset_to_draft(tid)


@admin.put("/matches/{match_id}/result")
def set_result(match_id: str, body: ResultIn, svc: TournamentService = Depends(get_service)):
    return svc.set_result(match_id, body.model_dump())


@admin.put("/matches/{match_id}/live")
def set_live(match_id: str, body: LiveIn, svc: TournamentService = Depends(get_service)):
    return svc.set_live(match_id, body.score1, body.score2, body.pen1, body.pen2)


@admin.delete("/matches/{match_id}/result")
def clear_result(match_id: str, svc: TournamentService = Depends(get_service)):
    return svc.clear_result(match_id)


app.include_router(public)
app.include_router(admin)
