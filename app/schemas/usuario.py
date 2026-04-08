import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


class UsuarioResponse(BaseModel):
    id: uuid.UUID
    nombre: str
    email: EmailStr
    avatar_url: Optional[str]
    timezone: str
    moneda: str
    modo_ui: str
    telegram_chat_id: Optional[str]
    email_verificado: bool
    creado_en: datetime

    model_config = {"from_attributes": True}


class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = None
    avatar_url: Optional[str] = None
    timezone: Optional[str] = None
    moneda: Optional[str] = None
    modo_ui: Optional[str] = None
    telegram_chat_id: Optional[str] = None


class UserSettingsResponse(BaseModel):
    iva_porcentaje: float
    alerta_presupuesto_pct: int
    dias_notif_recurrente: int
    dias_notif_corte: int
    auto_registrar_recurrentes: bool
    crypto_update_interval_min: int
    dia_inicio_semana: int

    model_config = {"from_attributes": True}


class UserSettingsUpdate(BaseModel):
    iva_porcentaje: Optional[float] = None
    alerta_presupuesto_pct: Optional[int] = None
    dias_notif_recurrente: Optional[int] = None
    dias_notif_corte: Optional[int] = None
    auto_registrar_recurrentes: Optional[bool] = None
    crypto_update_interval_min: Optional[int] = None
    dia_inicio_semana: Optional[int] = None
