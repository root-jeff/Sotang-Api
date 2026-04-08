import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, Any
from pydantic import BaseModel


class ActivoCreate(BaseModel):
    nombre: str
    tipo: str
    valor_compra: Decimal
    fecha_compra: date
    valor_actual: Decimal
    metodo_valoracion: str = "manual"
    tasa_depreciacion_anual: Optional[Decimal] = None
    descripcion: Optional[str] = None
    notas: Optional[str] = None


class ActivoUpdate(BaseModel):
    nombre: Optional[str] = None
    valor_actual: Optional[Decimal] = None
    tasa_depreciacion_anual: Optional[Decimal] = None
    metodo_valoracion: Optional[str] = None
    notas: Optional[str] = None
    activo: Optional[bool] = None


class ActivoResponse(BaseModel):
    id: uuid.UUID
    nombre: str
    tipo: str
    valor_compra: Decimal
    fecha_compra: date
    valor_actual: Decimal
    metodo_valoracion: str
    tasa_depreciacion_anual: Optional[Decimal]
    ultima_valoracion: date
    descripcion: Optional[str]
    activo: bool

    model_config = {"from_attributes": True}


class PasivoCreate(BaseModel):
    nombre: str
    tipo: str
    monto_original: Decimal
    saldo_pendiente: Decimal
    tasa_interes_anual: Optional[Decimal] = None
    fecha_inicio: date
    fecha_fin: Optional[date] = None
    cuota_mensual: Optional[Decimal] = None
    acreedor: Optional[str] = None


class PasivoResponse(BaseModel):
    id: uuid.UUID
    nombre: str
    tipo: str
    monto_original: Decimal
    saldo_pendiente: Decimal
    tasa_interes_anual: Optional[Decimal]
    fecha_inicio: date
    fecha_fin: Optional[date]
    cuota_mensual: Optional[Decimal]
    acreedor: Optional[str]
    activo: bool

    model_config = {"from_attributes": True}


class NetWorthResponse(BaseModel):
    activos_liquidos: Decimal
    activos_fisicos: Decimal
    total_activos: Decimal
    total_pasivos: Decimal
    net_worth: Decimal


class EquifaxResponse(BaseModel):
    id: uuid.UUID
    fecha_consulta: datetime
    score_principal: Optional[int]
    score_inclusion: Optional[int]
    segmentacion_riesgo: Optional[str]
    segmentacion_cliente: Optional[str]
    capacidad_pago: Optional[Decimal]
    nivel_ingresos: Optional[str]

    model_config = {"from_attributes": True}
