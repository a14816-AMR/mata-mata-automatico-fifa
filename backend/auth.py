"""Autenticação do administrador: palavra-passe → token assinado (HMAC) com validade."""
from __future__ import annotations

import base64
import hashlib
import hmac
import time

from fastapi import Header, HTTPException

from .config import get_settings


def _sign(payload: str) -> str:
    secret = get_settings().token_secret.encode()
    return hmac.new(secret, payload.encode(), hashlib.sha256).hexdigest()


def check_password(password: str) -> bool:
    expected = get_settings().admin_password
    return bool(expected) and hmac.compare_digest(password.encode(), expected.encode())


def issue_token() -> tuple[str, int]:
    s = get_settings()
    if not s.token_secret:
        raise HTTPException(500, "ADMIN_TOKEN_SECRET não está configurado no servidor.")
    expires = int(time.time()) + s.token_ttl_seconds
    payload = f"admin:{expires}"
    token = base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=") + "." + _sign(payload)
    return token, expires


def verify_token(token: str) -> bool:
    try:
        encoded, signature = token.split(".", 1)
        payload = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)).decode()
        role, expires = payload.split(":", 1)
    except (ValueError, UnicodeDecodeError):
        return False
    if not get_settings().token_secret or role != "admin":
        return False
    if not hmac.compare_digest(signature, _sign(payload)):
        return False
    return int(expires) > time.time()


def require_admin(authorization: str = Header(default="")) -> None:
    token = authorization.removeprefix("Bearer ").strip()
    if not token or not verify_token(token):
        raise HTTPException(401, "Sessão de administrador inválida ou expirada.")
