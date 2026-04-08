import uuid
import enum
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, SmallInteger, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMPTZ
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class PresupuestoPeriodoEnum(str, enum.Enum):
    mensual      = "mensual"
    semanal      = "semanal"
    anual        = "anual"
    personalizado = "personalizado"


class MetaTipoEnum(str, enum.Enum):
    cuenta_virtual   = "cuenta_virtual"
    cuenta_especifica = "cuenta_especifica"
    libre            = "libre"


class Presupuesto(Base):
    __tablename__ = "presupuestos"

    id:                 Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    usuario_id:         Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    categoria_id:       Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), ForeignKey("categorias.id", ondelete="RESTRICT"), nullable=False)
    monto:              Mapped[Decimal]          = mapped_column(nullable=False)
    periodo:            Mapped[str]              = mapped_column(String(15), nullable=False)
    fecha_inicio:       Mapped[Optional[date]]   = mapped_column(Date, nullable=True)
    fecha_fin:          Mapped[Optional[date]]   = mapped_column(Date, nullable=True)
    alerta_porcentaje:  Mapped[int]              = mapped_column(SmallInteger, nullable=False, server_default="80")
    activo:             Mapped[bool]             = mapped_column(Boolean, nullable=False, server_default=text("TRUE"))
    creado_en:          Mapped[datetime]         = mapped_column(TIMESTAMPTZ, nullable=False, server_default=text("NOW()"))

    categoria: Mapped["Categoria"] = relationship("Categoria")  # type: ignore[name-defined]

    __table_args__ = (
        CheckConstraint("monto > 0", name="ck_presupuestos_monto"),
        CheckConstraint("alerta_porcentaje BETWEEN 1 AND 100", name="ck_presupuestos_alerta"),
        CheckConstraint("fecha_fin IS NULL OR fecha_fin > fecha_inicio", name="ck_presupuestos_fechas"),
        CheckConstraint(
            "(periodo = 'personalizado' AND fecha_inicio IS NOT NULL) OR periodo != 'personalizado'",
            name="ck_presupuestos_personalizado"
        ),
    )


class MetaAhorro(Base):
    __tablename__ = "metas_ahorro"

    id:               Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    usuario_id:       Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    nombre:           Mapped[str]              = mapped_column(String(100), nullable=False)
    descripcion:      Mapped[Optional[str]]    = mapped_column(Text, nullable=True)
    monto_objetivo:   Mapped[Decimal]          = mapped_column(nullable=False)
    monto_actual:     Mapped[Decimal]          = mapped_column(nullable=False, server_default="0.00")
    fecha_objetivo:   Mapped[Optional[date]]   = mapped_column(Date, nullable=True)
    tipo:             Mapped[str]              = mapped_column(String(20), nullable=False)
    cuenta_id:        Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("cuentas.id", ondelete="SET NULL"), nullable=True)
    color:            Mapped[str]              = mapped_column(String(7), nullable=False, server_default="#10b981")
    icono:            Mapped[Optional[str]]    = mapped_column(String(50), nullable=True)
    prioridad:        Mapped[int]              = mapped_column(SmallInteger, nullable=False, server_default="0")
    activa:           Mapped[bool]             = mapped_column(Boolean, nullable=False, server_default=text("TRUE"))
    completada:       Mapped[bool]             = mapped_column(Boolean, nullable=False, server_default=text("FALSE"))
    fecha_completada: Mapped[Optional[date]]   = mapped_column(Date, nullable=True)
    creado_en:        Mapped[datetime]         = mapped_column(TIMESTAMPTZ, nullable=False, server_default=text("NOW()"))

    cuenta: Mapped[Optional["Cuenta"]] = relationship("Cuenta")  # type: ignore[name-defined]

    __table_args__ = (
        CheckConstraint("monto_objetivo > 0", name="ck_metas_objetivo"),
        CheckConstraint("monto_actual >= 0", name="ck_metas_actual_positivo"),
        CheckConstraint("monto_actual <= monto_objetivo OR completada = TRUE", name="ck_metas_actual_limite"),
    )
