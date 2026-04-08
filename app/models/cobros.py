import uuid
import enum
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import CheckConstraint, Date, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMPTZ
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class CobrarEstadoEnum(str, enum.Enum):
    pendiente   = "pendiente"
    parcial     = "parcial"
    cobrado     = "cobrado"
    incobrable  = "incobrable"


class DeudaInformalEstadoEnum(str, enum.Enum):
    pendiente = "pendiente"
    parcial   = "parcial"
    pagado    = "pagado"


class CuentaCobrar(Base):
    __tablename__ = "cuentas_por_cobrar"

    id:                  Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    usuario_id:          Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    deudor_nombre:       Mapped[str]              = mapped_column(String(150), nullable=False)
    deudor_email:        Mapped[Optional[str]]    = mapped_column(String(255), nullable=True)
    deudor_telegram:     Mapped[Optional[str]]    = mapped_column(String(100), nullable=True)
    deudor_telefono:     Mapped[Optional[str]]    = mapped_column(String(20), nullable=True)
    monto_original:      Mapped[Decimal]          = mapped_column(nullable=False)
    monto_pagado:        Mapped[Decimal]          = mapped_column(nullable=False, server_default="0.00")
    fecha_prestamo:      Mapped[date]             = mapped_column(Date, nullable=False)
    fecha_prometida:     Mapped[Optional[date]]   = mapped_column(Date, nullable=True)
    descripcion:         Mapped[Optional[str]]    = mapped_column(Text, nullable=True)
    estado:              Mapped[str]              = mapped_column(String(15), nullable=False, server_default="pendiente")
    ultimo_recordatorio: Mapped[Optional[datetime]] = mapped_column(TIMESTAMPTZ, nullable=True)
    notas:               Mapped[Optional[str]]    = mapped_column(Text, nullable=True)
    creado_en:           Mapped[datetime]         = mapped_column(TIMESTAMPTZ, nullable=False, server_default=text("NOW()"))

    abonos: Mapped[List["CuentaCobrarAbono"]] = relationship("CuentaCobrarAbono", back_populates="cuenta_cobrar", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("monto_original > 0", name="ck_cobrar_monto_original"),
        CheckConstraint("monto_pagado >= 0", name="ck_cobrar_monto_pagado"),
        CheckConstraint("monto_pagado <= monto_original", name="ck_cobrar_monto_limite"),
    )

    @property
    def saldo_pendiente(self) -> Decimal:
        return self.monto_original - self.monto_pagado


class CuentaCobrarAbono(Base):
    __tablename__ = "cuentas_por_cobrar_abonos"

    id:               Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    cuenta_cobrar_id: Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), ForeignKey("cuentas_por_cobrar.id", ondelete="CASCADE"), nullable=False)
    monto:            Mapped[Decimal]        = mapped_column(nullable=False)
    fecha:            Mapped[date]           = mapped_column(Date, nullable=False)
    notas:            Mapped[Optional[str]]  = mapped_column(Text, nullable=True)
    creado_en:        Mapped[datetime]       = mapped_column(TIMESTAMPTZ, nullable=False, server_default=text("NOW()"))

    cuenta_cobrar: Mapped["CuentaCobrar"] = relationship("CuentaCobrar", back_populates="abonos")

    __table_args__ = (
        CheckConstraint("monto > 0", name="ck_cobrar_abonos_monto"),
    )


class DeudaInformal(Base):
    __tablename__ = "deudas_informales"

    id:               Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    usuario_id:       Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    acreedor_nombre:  Mapped[str]              = mapped_column(String(150), nullable=False)
    monto_original:   Mapped[Decimal]          = mapped_column(nullable=False)
    monto_pagado:     Mapped[Decimal]          = mapped_column(nullable=False, server_default="0.00")
    fecha_deuda:      Mapped[date]             = mapped_column(Date, nullable=False)
    fecha_prometida:  Mapped[Optional[date]]   = mapped_column(Date, nullable=True)
    descripcion:      Mapped[Optional[str]]    = mapped_column(Text, nullable=True)
    estado:           Mapped[str]              = mapped_column(String(15), nullable=False, server_default="pendiente")
    notas:            Mapped[Optional[str]]    = mapped_column(Text, nullable=True)
    creado_en:        Mapped[datetime]         = mapped_column(TIMESTAMPTZ, nullable=False, server_default=text("NOW()"))

    abonos: Mapped[List["DeudaInformalAbono"]] = relationship("DeudaInformalAbono", back_populates="deuda", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("monto_original > 0", name="ck_deudas_monto_original"),
        CheckConstraint("monto_pagado >= 0", name="ck_deudas_monto_pagado"),
        CheckConstraint("monto_pagado <= monto_original", name="ck_deudas_monto_limite"),
    )

    @property
    def saldo_pendiente(self) -> Decimal:
        return self.monto_original - self.monto_pagado


class DeudaInformalAbono(Base):
    __tablename__ = "deudas_informales_abonos"

    id:        Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    deuda_id:  Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), ForeignKey("deudas_informales.id", ondelete="CASCADE"), nullable=False)
    monto:     Mapped[Decimal]        = mapped_column(nullable=False)
    fecha:     Mapped[date]           = mapped_column(Date, nullable=False)
    notas:     Mapped[Optional[str]]  = mapped_column(Text, nullable=True)
    creado_en: Mapped[datetime]       = mapped_column(TIMESTAMPTZ, nullable=False, server_default=text("NOW()"))

    deuda: Mapped["DeudaInformal"] = relationship("DeudaInformal", back_populates="abonos")

    __table_args__ = (
        CheckConstraint("monto > 0", name="ck_deudas_abonos_monto"),
    )
