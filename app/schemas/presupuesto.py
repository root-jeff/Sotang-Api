import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel


class PresupuestoCreate(BaseModel):
    categoria_id: uuid.UUID
    monto: Decimal
    periodo: str  # mensual | semanal | anual | personalizado
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    alerta_porcentaje: int = 80


class PresupuestoUpdate(BaseModel):
    monto: Optional[Decimal] = None
    alerta_porcentaje: Optional[int] = None
    activo: Optional[bool] = None


class PresupuestoResponse(BaseModel):
    id: uuid.UUID
    categoria_id: uuid.UUID
    monto: Decimal
    periodo: str
    fecha_inicio: Optional[date]
    fecha_fin: Optional[date]
    alerta_porcentaje: int
    activo: bool
    # Campos calculados en runtime
    gastado: Decimal = Decimal("0.00")
    gastado_pct: float = 0.0
    disponible: Decimal = Decimal("0.00")

    model_config = {"from_attributes": True}


class MetaAhorroCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    monto_objetivo: Decimal
    fecha_objetivo: Optional[date] = None
    tipo: str  # cuenta_virtual | cuenta_especifica | libre
    cuenta_id: Optional[uuid.UUID] = None
    color: str = "#10b981"
    icono: Optional[str] = None
    prioridad: int = 0


class MetaAhorroUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    monto_objetivo: Optional[Decimal] = None
    fecha_objetivo: Optional[date] = None
    color: Optional[str] = None
    icono: Optional[str] = None
    prioridad: Optional[int] = None
    activa: Optional[bool] = None


class MetaAhorroResponse(BaseModel):
    id: uuid.UUID
    nombre: str
    descripcion: Optional[str]
    monto_objetivo: Decimal
    monto_actual: Decimal
    fecha_objetivo: Optional[date]
    tipo: str
    cuenta_id: Optional[uuid.UUID]
    color: str
    icono: Optional[str]
    prioridad: int
    activa: bool
    completada: bool
    fecha_completada: Optional[date]
    # Calculados
    porcentaje: float = 0.0
    monto_faltante: Decimal = Decimal("0.00")

    model_config = {"from_attributes": True}


class AporteMetaRequest(BaseModel):
    monto: Decimal
    descripcion: Optional[str] = None
