import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, CheckConstraint, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMPTZ
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Adjunto(Base):
    __tablename__ = "adjuntos"

    id:              Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    usuario_id:      Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    transaccion_id:  Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("transacciones.id", ondelete="SET NULL"), nullable=True)
    nombre_original: Mapped[str]              = mapped_column(String(255), nullable=False)
    nombre_storage:  Mapped[str]              = mapped_column(String(255), nullable=False)
    ruta:            Mapped[str]              = mapped_column(String(500), nullable=False)
    tipo_mime:       Mapped[str]              = mapped_column(String(100), nullable=False)
    tamano_bytes:    Mapped[int]              = mapped_column(Integer, nullable=False)
    subido_en:       Mapped[datetime]         = mapped_column(TIMESTAMPTZ, nullable=False, server_default=text("NOW()"))

    transaccion: Mapped[Optional["Transaccion"]] = relationship("Transaccion", back_populates="adjuntos")  # type: ignore[name-defined]

    __table_args__ = (
        CheckConstraint("tamano_bytes > 0", name="ck_adjuntos_tamano_positivo"),
        CheckConstraint("tamano_bytes <= 10485760", name="ck_adjuntos_tamano_max"),
    )


class NotificacionLog(Base):
    __tablename__ = "notificaciones_log"

    id:            Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    usuario_id:    Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    evento:        Mapped[str]              = mapped_column(String(50), nullable=False)
    canal:         Mapped[str]              = mapped_column(String(10), nullable=False)
    estado:        Mapped[str]              = mapped_column(String(10), nullable=False)
    titulo:        Mapped[Optional[str]]    = mapped_column(String(255), nullable=True)
    mensaje:       Mapped[Optional[str]]    = mapped_column(Text, nullable=True)
    error_mensaje: Mapped[Optional[str]]    = mapped_column(Text, nullable=True)
    metadata:      Mapped[Optional[dict]]   = mapped_column(JSONB, nullable=True)
    creado_en:     Mapped[datetime]         = mapped_column(TIMESTAMPTZ, nullable=False, server_default=text("NOW()"))

    __table_args__ = (
        CheckConstraint("canal IN ('email', 'telegram', 'push')", name="ck_notif_log_canal"),
        CheckConstraint("estado IN ('enviado', 'fallido', 'pendiente')", name="ck_notif_log_estado"),
    )


class BackupLog(Base):
    __tablename__ = "backup_log"

    id:             Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tipo:           Mapped[str]              = mapped_column(String(20), nullable=False)
    estado:         Mapped[str]              = mapped_column(String(15), nullable=False)
    archivo_nombre: Mapped[Optional[str]]    = mapped_column(String(255), nullable=True)
    tamano_bytes:   Mapped[Optional[int]]    = mapped_column(BigInteger, nullable=True)
    gdrive_file_id: Mapped[Optional[str]]    = mapped_column(String(255), nullable=True)
    gdrive_url:     Mapped[Optional[str]]    = mapped_column(String(500), nullable=True)
    error_mensaje:  Mapped[Optional[str]]    = mapped_column(Text, nullable=True)
    iniciado_en:    Mapped[datetime]         = mapped_column(TIMESTAMPTZ, nullable=False, server_default=text("NOW()"))
    completado_en:  Mapped[Optional[datetime]] = mapped_column(TIMESTAMPTZ, nullable=True)

    __table_args__ = (
        CheckConstraint("tipo IN ('db_dump', 'data_export', 'adjuntos_sync')", name="ck_backup_tipo"),
        CheckConstraint("estado IN ('exitoso', 'fallido', 'en_progreso')", name="ck_backup_estado"),
    )
