from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # ── Base de datos ──────────────────────────────────────────────────────────
    DATABASE_URL: str

    # ── JWT ────────────────────────────────────────────────────────────────────
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Email (Resend) ─────────────────────────────────────────────────────────
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "notificaciones@raas-xtr.online"

    # ── Telegram ───────────────────────────────────────────────────────────────
    TELEGRAM_BOT_TOKEN: str = ""

    # ── CoinGecko ─────────────────────────────────────────────────────────────
    COINGECKO_API_KEY: str = ""

    # ── Google Drive (backups) ────────────────────────────────────────────────
    GDRIVE_SERVICE_ACCOUNT_JSON: str = "./secrets/gdrive-service-account.json"
    GDRIVE_BACKUP_FOLDER_ID: str = ""

    # ── Firebase ──────────────────────────────────────────────────────────────
    FIREBASE_CREDENTIALS_JSON: str = "./secrets/firebase-credentials.json"

    # ── App ────────────────────────────────────────────────────────────────────
    APP_ENV: str = "development"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
