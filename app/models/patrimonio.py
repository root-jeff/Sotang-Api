import uuid
import enum
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, SmallInteger, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMPTZ
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ActivoTipoEnum(str, enum.Enum):
    vehiculo      = "vehiculo"
    inmueble      = "inmueble"
    cripto        = "cripto"
    efectivo      = "efectivo"
    inversion     = "inversion"
    objeto_valor  = "objeto_valor"
    otro          = "otro"


class PasivoTipoEnum(str, enum.Enum):
    tarjeta_credito      = "tarjeta_credito"
    prestamo_personal    = "prestamo_personal"
    prestamo_hipotecario = "prestamo_hipotecario"
    prestamo_vehicular   = "prestamo_vehicular"
    deuda_informal       = "deuda_informal"
    otro                 = "otro"


class Activo(Base):
    __tablename__ = "activos"

    id:                      Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    usuario_id:              Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    nombre:                  Mapped[str]              = mapped_column(String(150), nullable=False)
    tipo:                    Mapped[str]              = mapped_column(String(20), nullable=False)
    valor_compra:            Mapped[Decimal]          = mapped_column(nullable=False)
    fecha_compra:            Mapped[date]             = mapped_column(Date, nullable=False)
    valor_actual:            Mapped[Decimal]          = mapped_column(nullable=False)
    metodo_valoracion:       Mapped[str]              = mapped_column(String(10), nullable=False, server_default="manual")
    tasa_depreciacion_anual: Mapped[Optional[Decimal]] = mapped_column(nullable=True)
    ultima_valoracion:       Mapped[date]             = mapped_column(Date, nullable=False)
    descripcion:             Mapped[Optional[str]]    = mapped_column(Text, nullable=True)
    notas:                   Mapped[Optional[str]]    = mapped_column(Text, nullable=True)
    activo:                  Mapped[bool]             = mapped_column(Boolean, nullable=False, server_default=text("TRUE"))
    creado_en:               Mapped[datetime]         = mapped_column(TIMESTAMPTZ, nullable=False, server_default=text("NOW()"))

    __table_args__ = (
        CheckConstraint("valor_compra > 0", name="ck_activos_valor_compra"),
        CheckConstraint("valor_actual >= 0", name="ck_activos_valor_actual"),
        CheckConstraint("tasa_depreciacion_anual BETWEEN 0 AND 100", name="ck_activos_depreciacion"),
        CheckConstraint("metodo_valoracion IN ('automatico', 'manual')", name="ck_activos_metodo"),
    )


class Pasivo(Base):
    __tablename__ = "pasivos"

    id:                 Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    usuario_id:         Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    nombre:             Mapped[str]              = mapped_column(String(150), nullable=False)
    tipo:               Mapped[str]              = mapped_column(String(25), nullable=False)
    monto_original:     Mapped[Decimal]          = mapped_column(nullable=False)
    saldo_pendiente:    Mapped[Decimal]          = mapped_column(nullable=False)
    tasa_interes_anual: Mapped[Optional[Decimal]] = mapped_column(nullable=True)
    fecha_inicio:       Mapped[date]             = mapped_column(Date, nullable=False)
    fecha_fin:          Mapped[Optional[date]]   = mapped_column(Date, nullable=True)
    cuota_mensual:      Mapped[Optional[Decimal]] = mapped_column(nullable=True)
    acreedor:           Mapped[Optional[str]]    = mapped_column(String(150), nullable=True)
    activo:             Mapped[bool]             = mapped_column(Boolean, nullable=False, server_default=text("TRUE"))
    creado_en:          Mapped[datetime]         = mapped_column(TIMESTAMPTZ, nullable=False, server_default=text("NOW()"))

    __table_args__ = (
        CheckConstraint("monto_original > 0", name="ck_pasivos_monto_original"),
        CheckConstraint("saldo_pendiente >= 0", name="ck_pasivos_saldo_pendiente"),
        CheckConstraint("saldo_pendiente <= monto_original", name="ck_pasivos_saldo_limite"),
    )


class EquifaxReporte(Base):
    __tablename__ = "equifax_reportes"

    id:                       Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    usuario_id:               Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    equifax_transaction_id:   Mapped[str]              = mapped_column(String(100), nullable=False)
    fecha_consulta:           Mapped[datetime]         = mapped_column(TIMESTAMPTZ, nullable=False, server_default=text("NOW()"))
    score_principal:          Mapped[Optional[int]]    = mapped_column(SmallInteger, nullable=True)
    score_inclusion:          Mapped[Optional[int]]    = mapped_column(SmallInteger, nullable=True)
    score_sobreendeudamiento: Mapped[Optional[int]]    = mapped_column(SmallInteger, nullable=True)
    segmentacion_riesgo:      Mapped[Optional[str]]    = mapped_column(String(20), nullable=True)
    segmentacion_cliente:     Mapped[Optional[str]]    = mapped_column(String(5), nullable=True)
    modelo_utilizado:         Mapped[Optional[str]]    = mapped_column(String(50), nullable=True)
    capacidad_pago:           Mapped[Optional[Decimal]] = mapped_column(nullable=True)
    gasto_financiero:         Mapped[Optional[Decimal]] = mapped_column(nullable=True)
    income_predictor:         Mapped[Optional[Decimal]] = mapped_column(nullable=True)
    cupo_sugerido:            Mapped[Optional[Decimal]] = mapped_column(nullable=True)
    nivel_ingresos:           Mapped[Optional[str]]    = mapped_column(String(20), nullable=True)
    inhabilitado:             Mapped[Optional[bool]]   = mapped_column(Boolean, nullable=True)
    total_deuda_sb:           Mapped[Optional[Decimal]] = mapped_column(nullable=True)
    total_deuda_seps:         Mapped[Optional[Decimal]] = mapped_column(nullable=True)
    total_deuda_sicom:        Mapped[Optional[Decimal]] = mapped_column(nullable=True)
    historico_score:          Mapped[Optional[dict]]   = mapped_column(JSONB, nullable=True)
    historico_endeudamiento:  Mapped[Optional[dict]]   = mapped_column(JSONB, nullable=True)
    raw_json:                 Mapped[dict]             = mapped_column(JSONB, nullable=False)
    archivo_path:             Mapped[Optional[str]]    = mapped_column(String(500), nullable=True)
    creado_en:                Mapped[datetime]         = mapped_column(TIMESTAMPTZ, nullable=False, server_default=text("NOW()"))

    __table_args__ = (
        UniqueConstraint("usuario_id", "equifax_transaction_id", name="uq_equifax_transaction"),
    )


class CriptoPrecioHistorico(Base):
    __tablename__ = "cripto_precios_historico"

    id:            Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    simbolo:       Mapped[str]       = mapped_column(String(20), nullable=False)
    coingecko_id:  Mapped[str]       = mapped_column(String(100), nullable=False)
    precio_usd:    Mapped[Decimal]   = mapped_column(nullable=False)
    registrado_en: Mapped[datetime]  = mapped_column(TIMESTAMPTZ, nullable=False, server_default=text("NOW()"))
