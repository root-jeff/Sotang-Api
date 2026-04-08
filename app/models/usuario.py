import uuid
import enum
from datetime import datetime
from typing import Optional, List

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, SmallInteger, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMPTZ
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class NotifEventoEnum(str, enum.Enum):
    recurrente_dia_antes       = "recurrente_dia_antes"
    corte_tarjeta_dia_antes    = "corte_tarjeta_dia_antes"
    meta_completada            = "meta_completada"
    meta_progreso              = "meta_progreso"
    presupuesto_alerta         = "presupuesto_alerta"
    presupuesto_excedido       = "presupuesto_excedido"
    deuda_vencida              = "deuda_vencida"
    cuenta_cobrar_recordatorio = "cuenta_cobrar_recordatorio"
    backup_fallido             = "backup_fallido"
    crypto_precio_error        = "crypto_precio_error"


class Usuario(Base):
    __tablename__ = "usuarios"

    id:               Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    nombre:           Mapped[str]              = mapped_column(String(100), nullable=False)
    email:            Mapped[str]              = mapped_column(String(255), nullable=False)
    password_hash:    Mapped[str]              = mapped_column(String(255), nullable=False)
    avatar_url:       Mapped[Optional[str]]    = mapped_column(String(500), nullable=True)
    timezone:         Mapped[str]              = mapped_column(String(50), nullable=False, server_default="America/Guayaquil")
    moneda:           Mapped[str]              = mapped_column(String(3), nullable=False, server_default="USD")
    modo_ui:          Mapped[str]              = mapped_column(String(10), nullable=False, server_default="system")
    telegram_chat_id: Mapped[Optional[str]]    = mapped_column(String(50), nullable=True)
    activo:           Mapped[bool]             = mapped_column(Boolean, nullable=False, server_default=text("TRUE"))
    email_verificado: Mapped[bool]             = mapped_column(Boolean, nullable=False, server_default=text("FALSE"))
    creado_en:        Mapped[datetime]         = mapped_column(TIMESTAMPTZ, nullable=False, server_default=text("NOW()"))
    ultimo_login:     Mapped[Optional[datetime]] = mapped_column(TIMESTAMPTZ, nullable=True)

    # Relationships
    settings:                  Mapped[Optional["UserSettings"]]            = relationship("UserSettings", back_populates="usuario", uselist=False, cascade="all, delete-orphan")
    notification_preferences:  Mapped[List["NotificationPreference"]]      = relationship("NotificationPreference", back_populates="usuario", cascade="all, delete-orphan")
    refresh_tokens:            Mapped[List["RefreshToken"]]                = relationship("RefreshToken", back_populates="usuario", cascade="all, delete-orphan")
    cuentas:                   Mapped[List["Cuenta"]]                      = relationship("Cuenta", back_populates="usuario", cascade="all, delete-orphan")  # type: ignore[name-defined]

    __table_args__ = (
        UniqueConstraint("email", name="uq_usuarios_email"),
        CheckConstraint("modo_ui IN ('light', 'dark', 'system')", name="ck_usuarios_modo_ui"),
    )


class UserSettings(Base):
    __tablename__ = "user_settings"

    id:                          Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    usuario_id:                  Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    iva_porcentaje:              Mapped[float]     = mapped_column(nullable=False, server_default="15.00")
    alerta_presupuesto_pct:      Mapped[int]       = mapped_column(SmallInteger, nullable=False, server_default="80")
    dias_notif_recurrente:       Mapped[int]       = mapped_column(SmallInteger, nullable=False, server_default="1")
    dias_notif_corte:            Mapped[int]       = mapped_column(SmallInteger, nullable=False, server_default="1")
    auto_registrar_recurrentes:  Mapped[bool]      = mapped_column(Boolean, nullable=False, server_default=text("TRUE"))
    crypto_update_interval_min:  Mapped[int]       = mapped_column(SmallInteger, nullable=False, server_default="30")
    dia_inicio_semana:           Mapped[int]       = mapped_column(SmallInteger, nullable=False, server_default="1")

    usuario: Mapped["Usuario"] = relationship("Usuario", back_populates="settings")

    __table_args__ = (
        UniqueConstraint("usuario_id", name="uq_user_settings_usuario"),
        CheckConstraint("alerta_presupuesto_pct BETWEEN 1 AND 100", name="ck_settings_alerta_pct"),
        CheckConstraint("iva_porcentaje BETWEEN 0 AND 100", name="ck_settings_iva"),
    )


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id:             Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    usuario_id:     Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    evento:         Mapped[str]              = mapped_column(String(50), nullable=False)
    canal_email:    Mapped[bool]             = mapped_column(Boolean, nullable=False, server_default=text("TRUE"))
    canal_telegram: Mapped[bool]             = mapped_column(Boolean, nullable=False, server_default=text("TRUE"))
    canal_push:     Mapped[bool]             = mapped_column(Boolean, nullable=False, server_default=text("TRUE"))

    usuario: Mapped["Usuario"] = relationship("Usuario", back_populates="notification_preferences")

    __table_args__ = (
        UniqueConstraint("usuario_id", "evento", name="uq_notif_pref_usuario_evento"),
    )


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id:          Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    usuario_id:  Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    token_hash:  Mapped[str]              = mapped_column(String(255), nullable=False)
    expira_en:   Mapped[datetime]         = mapped_column(TIMESTAMPTZ, nullable=False)
    revocado:    Mapped[bool]             = mapped_column(Boolean, nullable=False, server_default=text("FALSE"))
    creado_en:   Mapped[datetime]         = mapped_column(TIMESTAMPTZ, nullable=False, server_default=text("NOW()"))
    ip_address:  Mapped[Optional[str]]    = mapped_column(String(45), nullable=True)
    user_agent:  Mapped[Optional[str]]    = mapped_column(String(500), nullable=True)

    usuario: Mapped["Usuario"] = relationship("Usuario", back_populates="refresh_tokens")
