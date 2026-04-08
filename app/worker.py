"""
Celery worker — tareas en background.

Tareas principales:
  - Actualizar precios de cripto (CoinGecko) cada N minutos
  - Ejecutar transacciones recurrentes diariamente
  - Limpiar tokens expirados semanalmente
  - Backup de base de datos a Google Drive
"""
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "sotang",
    broker=f"redis://{settings.REDIS_HOST}:6379/0",
    backend=f"redis://{settings.REDIS_HOST}:6379/1",
    include=["app.tasks.cripto", "app.tasks.recurrentes", "app.tasks.mantenimiento"],
)

celery_app.conf.beat_schedule = {
    # Precios cripto según intervalo configurado (default 30 min)
    "actualizar-cripto": {
        "task": "app.tasks.cripto.actualizar_precios",
        "schedule": 60 * 30,  # 30 minutos
    },
    # Transacciones recurrentes — ejecutar las que toca hoy
    "procesar-recurrentes": {
        "task": "app.tasks.recurrentes.procesar_recurrentes_del_dia",
        "schedule": 3600,  # cada hora (para no perder ejecuciones si el sistema estuvo apagado)
    },
    # Limpiar refresh tokens expirados
    "limpiar-tokens": {
        "task": "app.tasks.mantenimiento.limpiar_tokens_expirados",
        "schedule": 60 * 60 * 24 * 7,  # semanal
    },
    # Backup automático — diario a las 3 AM
    "backup-diario": {
        "task": "app.tasks.mantenimiento.backup_db",
        "schedule": 60 * 60 * 24,
    },
}

celery_app.conf.timezone = "America/Guayaquil"
