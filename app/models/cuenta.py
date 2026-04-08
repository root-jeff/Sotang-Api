import uuid
import enum
from datetime import datetime
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, SmallInteger, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMPTZ
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class CuentaTipoEnum(str, enum.Enum):
    banco           = "banco"
    tarjeta_credito = "tarjeta_credito"
    efectivo        = "efectivo"
    ahorro_virtual  = "ahorro_virtual"
    ahorro_cuenta   = "ahorro_cuenta"
    fondo_inversion = "fondo_inversion"
    cripto          = "cripto"


class Cuenta(Base):
    __tablename__ = "cuentas"

    id:               Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    usuario_id:       Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    nombre:           Mapped[str]              = mapped_column(String(100), nullable=False)
    tipo:             Mapped[str]              = mapped_column(String(20), nullable=False)
    moneda:           Mapped[str]              = mapped_column(String(3), nullable=False, server_default="USD")
    saldo_inicial:    Mapped[Decimal]          = mapped_column(nullable=False, server_default="0.00")
    saldo_actual:     Mapped[Decimal]          = mapped_column(nullable=False, server_default="0.00")
    color:            Mapped[str]              = mapped_column(String(7), nullable=False, server_default="#6366f1")
    icono:            Mapped[Optional[str]]    = mapped_column(String(50), nullable=True)
    activa:           Mapped[bool]             = mapped_column(Boolean, nullable=False, server_default=text("TRUE"))
    incluir_en_total: Mapped[bool]             = mapped_column(Boolean, nullable=False, server_default=text("TRUE"))
    orden:            Mapped[int]              = mapped_column(SmallInteger, nullable=False, server_default="0")
    notas:            Mapped[Optional[str]]    = mapped_column(Text, nullable=True)
    creado_en:        Mapped[datetime]         = mapped_column(TIMESTAMPTZ, nullable=False, server_default=text("NOW()"))

    usuario:             Mapped["Usuario"]                           = relationship("Usuario", back_populates="cuentas")  # type: ignore[name-defined]
    tarjeta_config:      Mapped[Optional["TarjetaConfig"]]           = relationship("TarjetaConfig", back_populates="cuenta", uselist=False, cascade="all, delete-orphan")
    cripto_config:       Mapped[Optional["CriptoConfig"]]            = relationship("CriptoConfig", back_populates="cuenta", uselist=False, cascade="all, delete-orphan")
    ahorro_virtual_config: Mapped[Optional["AhorroVirtualConfig"]]   = relationship("AhorroVirtualConfig", foreign_keys="AhorroVirtualConfig.cuenta_id", back_populates="cuenta", uselist=False, cascade="all, delete-orphan")
    transacciones:       Mapped[List["Transaccion"]]                 = relationship("Transaccion", foreign_keys="Transaccion.cuenta_id", back_populates="cuenta")  # type: ignore[name-defined]


class CupoGrupo(Base):
    __tablename__ = "cupos_grupos"

    id:          Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    usuario_id:  Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    nombre:      Mapped[str]       = mapped_column(String(100), nullable=False)
    cupo_total:  Mapped[Decimal]   = mapped_column(nullable=False)
    creado_en:   Mapped[datetime]  = mapped_column(TIMESTAMPTZ, nullable=False, server_default=text("NOW()"))

    tarjetas: Mapped[List["TarjetaConfig"]] = relationship("TarjetaConfig", back_populates="cupo_grupo")


class TarjetaConfig(Base):
    __tablename__ = "tarjetas_config"

    id:                  Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    cuenta_id:           Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), ForeignKey("cuentas.id", ondelete="CASCADE"), nullable=False)
    cupo_total:          Mapped[Decimal]          = mapped_column(nullable=False)
    cupo_grupo_id:       Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("cupos_grupos.id", ondelete="SET NULL"), nullable=True)
    fecha_corte:         Mapped[int]              = mapped_column(SmallInteger, nullable=False)
    fecha_pago:          Mapped[int]              = mapped_column(SmallInteger, nullable=False)
    tasa_interes_anual:  Mapped[Optional[Decimal]] = mapped_column(nullable=True)
    banco:               Mapped[Optional[str]]    = mapped_column(String(100), nullable=True)
    ultimos_4:           Mapped[Optional[str]]    = mapped_column(String(4), nullable=True)

    cuenta:     Mapped["Cuenta"]              = relationship("Cuenta", back_populates="tarjeta_config")
    cupo_grupo: Mapped[Optional["CupoGrupo"]] = relationship("CupoGrupo", back_populates="tarjetas")

    __table_args__ = (
        UniqueConstraint("cuenta_id", name="uq_tarjetas_cuenta"),
        CheckConstraint("fecha_corte BETWEEN 1 AND 31", name="ck_tarjetas_fecha_corte"),
        CheckConstraint("fecha_pago BETWEEN 1 AND 31", name="ck_tarjetas_fecha_pago"),
    )


class CriptoConfig(Base):
    __tablename__ = "cripto_config"

    id:                     Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    cuenta_id:              Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), ForeignKey("cuentas.id", ondelete="CASCADE"), nullable=False)
    simbolo:                Mapped[str]              = mapped_column(String(20), nullable=False)
    coingecko_id:           Mapped[str]              = mapped_column(String(100), nullable=False)
    cantidad:               Mapped[Decimal]          = mapped_column(nullable=False, server_default="0")
    precio_compra_promedio: Mapped[Optional[Decimal]] = mapped_column(nullable=True)
    precio_actual_usd:      Mapped[Optional[Decimal]] = mapped_column(nullable=True)
    precio_desactualizado:  Mapped[bool]             = mapped_column(Boolean, nullable=False, server_default=text("FALSE"))
    ultima_actualizacion:   Mapped[Optional[datetime]] = mapped_column(TIMESTAMPTZ, nullable=True)

    cuenta: Mapped["Cuenta"] = relationship("Cuenta", back_populates="cripto_config")

    __table_args__ = (
        UniqueConstraint("cuenta_id", name="uq_cripto_config_cuenta"),
        CheckConstraint("cantidad >= 0", name="ck_cripto_cantidad"),
    )


class AhorroVirtualConfig(Base):
    __tablename__ = "ahorro_virtual_config"

    id:              Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    cuenta_id:       Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cuentas.id", ondelete="CASCADE"), nullable=False)
    cuenta_padre_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cuentas.id", ondelete="CASCADE"), nullable=False)

    cuenta:       Mapped["Cuenta"] = relationship("Cuenta", foreign_keys=[cuenta_id], back_populates="ahorro_virtual_config")
    cuenta_padre: Mapped["Cuenta"] = relationship("Cuenta", foreign_keys=[cuenta_padre_id])

    __table_args__ = (
        UniqueConstraint("cuenta_id", name="uq_ahorro_virtual_cuenta"),
        CheckConstraint("cuenta_id != cuenta_padre_id", name="ck_ahorro_virtual_no_self"),
    )
