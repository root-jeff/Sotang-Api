import uuid
import enum
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, SmallInteger, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMPTZ
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class TxnTipoEnum(str, enum.Enum):
    ingreso      = "ingreso"
    gasto        = "gasto"
    transferencia = "transferencia"


class TxnCanalEnum(str, enum.Enum):
    web      = "web"
    mobile   = "mobile"
    telegram = "telegram"
    email    = "email"


class TxnEstadoEnum(str, enum.Enum):
    completada = "completada"
    pendiente  = "pendiente"
    en_proceso = "en_proceso"
    anulada    = "anulada"


class RecurrenteFreqEnum(str, enum.Enum):
    diaria    = "diaria"
    semanal   = "semanal"
    quincenal = "quincenal"
    mensual   = "mensual"
    anual     = "anual"


class Categoria(Base):
    __tablename__ = "categorias"

    id:         Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    usuario_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=True)
    nombre:     Mapped[str]              = mapped_column(String(100), nullable=False)
    tipo:       Mapped[str]              = mapped_column(String(10), nullable=False)
    color:      Mapped[str]              = mapped_column(String(7), nullable=False, server_default="#6366f1")
    icono:      Mapped[Optional[str]]    = mapped_column(String(50), nullable=True)
    activa:     Mapped[bool]             = mapped_column(Boolean, nullable=False, server_default=text("TRUE"))
    es_sistema: Mapped[bool]             = mapped_column(Boolean, nullable=False, server_default=text("FALSE"))
    parent_id:  Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("categorias.id", ondelete="SET NULL"), nullable=True)
    orden:      Mapped[int]              = mapped_column(SmallInteger, nullable=False, server_default="0")

    subcategorias: Mapped[List["Categoria"]]    = relationship("Categoria", back_populates="parent")
    parent:        Mapped[Optional["Categoria"]] = relationship("Categoria", back_populates="subcategorias", remote_side="Categoria.id")
    transacciones: Mapped[List["Transaccion"]]  = relationship("Transaccion", back_populates="categoria")

    __table_args__ = (
        CheckConstraint("tipo IN ('ingreso', 'gasto', 'ambos')", name="ck_categorias_tipo"),
        CheckConstraint("parent_id != id", name="ck_categorias_no_self_parent"),
    )


class Etiqueta(Base):
    __tablename__ = "etiquetas"

    id:         Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    usuario_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    nombre:     Mapped[str]       = mapped_column(String(50), nullable=False)
    color:      Mapped[str]       = mapped_column(String(7), nullable=False, server_default="#6366f1")

    transacciones: Mapped[List["Transaccion"]] = relationship("Transaccion", secondary="transacciones_etiquetas", back_populates="etiquetas")

    __table_args__ = (
        UniqueConstraint("usuario_id", "nombre", name="uq_etiquetas_usuario_nombre"),
    )


class TransaccionEtiqueta(Base):
    __tablename__ = "transacciones_etiquetas"

    transaccion_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("transacciones.id", ondelete="CASCADE"), primary_key=True)
    etiqueta_id:    Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("etiquetas.id", ondelete="CASCADE"), primary_key=True)


class TransaccionRecurrente(Base):
    __tablename__ = "transacciones_recurrentes"

    id:               Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    usuario_id:       Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    tipo:             Mapped[str]              = mapped_column(String(15), nullable=False)
    monto:            Mapped[Decimal]          = mapped_column(nullable=False)
    categoria_id:     Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), ForeignKey("categorias.id", ondelete="RESTRICT"), nullable=False)
    cuenta_id:        Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), ForeignKey("cuentas.id", ondelete="RESTRICT"), nullable=False)
    descripcion:      Mapped[Optional[str]]    = mapped_column(String(500), nullable=True)
    frecuencia:       Mapped[str]              = mapped_column(String(15), nullable=False)
    dia_del_mes:      Mapped[Optional[int]]    = mapped_column(SmallInteger, nullable=True)
    dia_de_semana:    Mapped[Optional[int]]    = mapped_column(SmallInteger, nullable=True)
    fecha_inicio:     Mapped[date]             = mapped_column(Date, nullable=False)
    fecha_fin:        Mapped[Optional[date]]   = mapped_column(Date, nullable=True)
    activa:           Mapped[bool]             = mapped_column(Boolean, nullable=False, server_default=text("TRUE"))
    proxima_ejecucion: Mapped[date]            = mapped_column(Date, nullable=False)
    ultima_ejecucion: Mapped[Optional[date]]   = mapped_column(Date, nullable=True)
    creado_en:        Mapped[datetime]         = mapped_column(TIMESTAMPTZ, nullable=False, server_default=text("NOW()"))

    transacciones: Mapped[List["Transaccion"]] = relationship("Transaccion", back_populates="recurrente")

    __table_args__ = (
        CheckConstraint("monto > 0", name="ck_recurrentes_monto"),
        CheckConstraint("dia_del_mes BETWEEN 1 AND 31", name="ck_recurrentes_dia_mes"),
        CheckConstraint("dia_de_semana BETWEEN 0 AND 6", name="ck_recurrentes_dia_semana"),
        CheckConstraint("fecha_fin IS NULL OR fecha_fin > fecha_inicio", name="ck_recurrentes_fechas"),
    )


class Transaccion(Base):
    __tablename__ = "transacciones"

    id:               Mapped[uuid.UUID]           = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    usuario_id:       Mapped[uuid.UUID]           = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    tipo:             Mapped[str]                 = mapped_column(String(15), nullable=False)
    monto:            Mapped[Decimal]             = mapped_column(nullable=False)
    monto_sin_iva:    Mapped[Optional[Decimal]]   = mapped_column(nullable=True)
    iva_monto:        Mapped[Optional[Decimal]]   = mapped_column(nullable=True)
    incluye_iva:      Mapped[bool]                = mapped_column(Boolean, nullable=False, server_default=text("FALSE"))
    categoria_id:     Mapped[uuid.UUID]           = mapped_column(UUID(as_uuid=True), ForeignKey("categorias.id", ondelete="RESTRICT"), nullable=False)
    cuenta_id:        Mapped[uuid.UUID]           = mapped_column(UUID(as_uuid=True), ForeignKey("cuentas.id", ondelete="RESTRICT"), nullable=False)
    cuenta_destino_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("cuentas.id", ondelete="RESTRICT"), nullable=True)
    descripcion:      Mapped[Optional[str]]       = mapped_column(String(500), nullable=True)
    fecha:            Mapped[date]                = mapped_column(Date, nullable=False)
    canal:            Mapped[str]                 = mapped_column(String(10), nullable=False, server_default="web")
    recurrente_id:    Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("transacciones_recurrentes.id", ondelete="SET NULL"), nullable=True)
    estado:           Mapped[str]                 = mapped_column(String(15), nullable=False, server_default="completada")
    notas:            Mapped[Optional[str]]       = mapped_column(Text, nullable=True)
    creado_en:        Mapped[datetime]            = mapped_column(TIMESTAMPTZ, nullable=False, server_default=text("NOW()"))
    actualizado_en:   Mapped[datetime]            = mapped_column(TIMESTAMPTZ, nullable=False, server_default=text("NOW()"))

    categoria:  Mapped["Categoria"]                      = relationship("Categoria", back_populates="transacciones")
    cuenta:     Mapped["Cuenta"]                         = relationship("Cuenta", foreign_keys=[cuenta_id], back_populates="transacciones")  # type: ignore[name-defined]
    recurrente: Mapped[Optional["TransaccionRecurrente"]] = relationship("TransaccionRecurrente", back_populates="transacciones")
    etiquetas:  Mapped[List["Etiqueta"]]                 = relationship("Etiqueta", secondary="transacciones_etiquetas", back_populates="transacciones")
    adjuntos:   Mapped[List["Adjunto"]]                  = relationship("Adjunto", back_populates="transaccion")  # type: ignore[name-defined]

    __table_args__ = (
        CheckConstraint("monto > 0", name="ck_txn_monto"),
        CheckConstraint("cuenta_id != cuenta_destino_id", name="ck_txn_cuentas_distintas"),
    )
