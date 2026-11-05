from __future__ import annotations

from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    password: str


class TournamentIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class TeamIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    club_id: str
    players: str = Field(default='', max_length=120)


class TeamsIn(BaseModel):
    teams: list[TeamIn] = Field(max_length=128)


class SlotIn(BaseModel):
    position: int = Field(ge=0)
    team1_id: str | None = None
    team2_id: str | None = None


class LayoutIn(BaseModel):
    slots: list[SlotIn]


class VisibilityIn(BaseModel):
    bracket_public: bool


class LiveIn(BaseModel):
    score1: int = Field(default=0, ge=0, le=99)
    score2: int = Field(default=0, ge=0, le=99)
    pen1: int | None = Field(default=None, ge=0, le=99)
    pen2: int | None = Field(default=None, ge=0, le=99)


class ResultIn(BaseModel):
    score1: int = Field(ge=0, le=99)
    score2: int = Field(ge=0, le=99)
    had_penalties: bool = False
    pen1: int | None = Field(default=None, ge=0, le=99)
    pen2: int | None = Field(default=None, ge=0, le=99)
