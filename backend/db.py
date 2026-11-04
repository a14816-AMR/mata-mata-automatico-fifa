"""Cliente mínimo para a API REST (PostgREST) do Supabase, com a service role key.

A service role ignora o RLS, por isso este cliente só existe no servidor.
"""
from __future__ import annotations

from typing import Any

import httpx

from .config import get_settings


class DatabaseError(RuntimeError):
    pass


class DB:
    def __init__(self) -> None:
        s = get_settings()
        if not s.supabase_url or not s.supabase_service_key:
            raise DatabaseError(
                "Supabase não configurado: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY."
            )
        key = s.supabase_service_key
        headers = {"apikey": key, "Content-Type": "application/json"}
        # Chaves antigas (JWT "eyJ...") também vão no Authorization. As novas
        # (sb_secret_...) não são JWT: o Supabase só as aceita no cabeçalho apikey.
        if key.startswith("eyJ"):
            headers["Authorization"] = f"Bearer {key}"
        self._client = httpx.Client(
            base_url=f"{s.supabase_url}/rest/v1", headers=headers, timeout=20
        )

    def _request(self, method: str, table: str, *, params=None, json=None, prefer=None) -> Any:
        headers = {"Prefer": prefer} if prefer else {}
        resp = self._client.request(method, f"/{table}", params=params, json=json, headers=headers)
        if resp.status_code >= 400:
            try:
                detail = resp.json().get("message", resp.text)
            except ValueError:
                detail = resp.text
            if "Could not find the" in str(detail) and "column" in str(detail):
                raise DatabaseError(
                    "A base de dados está desatualizada: falta uma coluna "
                    f"({detail}). Execute as migrações de supabase/migrations/ no "
                    "SQL Editor do Supabase (ver README)."
                )
            raise DatabaseError(f"Erro na base de dados ({resp.status_code}): {detail}")
        if not resp.content:
            return []
        return resp.json()

    def select(self, table: str, params: dict[str, str]) -> list[dict]:
        return self._request("GET", table, params={"select": "*", **params})

    def insert(self, table: str, rows: list[dict] | dict) -> list[dict]:
        if isinstance(rows, list) and not rows:
            return []
        return self._request("POST", table, json=rows, prefer="return=representation")

    def update(self, table: str, filters: dict[str, str], values: dict) -> list[dict]:
        return self._request(
            "PATCH", table, params=filters, json=values, prefer="return=representation"
        )

    def upsert(self, table: str, rows: list[dict], on_conflict: str = "id") -> list[dict]:
        """Grava várias linhas numa única transação (um só pedido HTTP)."""
        if not rows:
            return []
        return self._request(
            "POST",
            table,
            params={"on_conflict": on_conflict},
            json=rows,
            prefer="resolution=merge-duplicates,return=representation",
        )

    def delete(self, table: str, filters: dict[str, str]) -> None:
        self._request("DELETE", table, params=filters)


_db: DB | None = None


def get_db() -> DB:
    global _db
    if _db is None:
        _db = DB()
    return _db
