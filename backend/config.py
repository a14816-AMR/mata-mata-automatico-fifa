import os
from functools import lru_cache
from pathlib import Path

try:  # .env só é usado em desenvolvimento local
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:  # pragma: no cover
    pass


class Settings:
    def __init__(self) -> None:
        self.supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        self.supabase_service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        self.admin_password = os.environ.get("ADMIN_PASSWORD", "")
        self.token_secret = os.environ.get("ADMIN_TOKEN_SECRET", "")
        self.token_ttl_seconds = int(os.environ.get("ADMIN_TOKEN_TTL_HOURS", "24")) * 3600
        self.cors_origins = [
            o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()
        ]

    def missing(self) -> list[str]:
        names = {
            "SUPABASE_URL": self.supabase_url,
            "SUPABASE_SERVICE_ROLE_KEY": self.supabase_service_key,
            "ADMIN_PASSWORD": self.admin_password,
            "ADMIN_TOKEN_SECRET": self.token_secret,
        }
        return [k for k, v in names.items() if not v]


@lru_cache
def get_settings() -> Settings:
    return Settings()
