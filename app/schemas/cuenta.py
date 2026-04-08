import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel


class CuentaCreate(BaseModel):
    nombre: str
    tipo: str
    moneda: str = "USD"
    saldo_inicial: Decimal = Decimal("0.00")
    color: str = "#6366f1"
    icono: Optional[str] = None
    incluir_en_total: bool = True
    orden: int = 0
    notas: Optional[str] = None


class CuentaUpdate(BaseModel):
    nombre: Optional[str] = None
    color: Optional[str] = None
    icono: Optional[str] = None
    incluir_en_total: Optional[bool] = None
    orden: Optional[int] = None
    notas: Optional[str] = None
    activa: Optional[bool] = None


class CuentaResponse(BaseModel):
    id: uuid.UUID
    nombre: str
    tipo: str
    moneda: str
    saldo_inicial: Decimal
    saldo_actual: Decimal
    color: str
    icono: Optional[str]
    activa: bool
    incluir_en_total: bool
    orden: int
    creado_en: datetime

    model_config = {"from_attributes": True}


class TarjetaConfigCreate(BaseModel):
    cupo_total: Decimal
    cupo_grupo_id: Optional[uuid.UUID] = None
    fecha_corte: int
    fecha_pago: int
    tasa_interes_anual: Optional[Decimal] = None
    banco: Optional[str] = None
    ultimos_4: Optional[str] = None


class CupoGrupoCreate(BaseModel):
    nombre: str
    cupo_total: Decimal


class CupoGrupoResponse(BaseModel):
    id: uuid.UUID
    nombre: str
    cupo_total: Decimal
    creado_en: datetime

    model_config = {"from_attributes": True}
