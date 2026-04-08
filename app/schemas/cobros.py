import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel


class CuentaCobrarCreate(BaseModel):
    deudor_nombre: str
    deudor_email: Optional[str] = None
    deudor_telegram: Optional[str] = None
    deudor_telefono: Optional[str] = None
    monto_original: Decimal
    fecha_prestamo: date
    fecha_prometida: Optional[date] = None
    descripcion: Optional[str] = None
    notas: Optional[str] = None


class AbonoCreate(BaseModel):
    monto: Decimal
    fecha: date
    notas: Optional[str] = None


class CuentaCobrarResponse(BaseModel):
    id: uuid.UUID
    deudor_nombre: str
    deudor_email: Optional[str]
    deudor_telefono: Optional[str]
    monto_original: Decimal
    monto_pagado: Decimal
    saldo_pendiente: Decimal
    fecha_prestamo: date
    fecha_prometida: Optional[date]
    descripcion: Optional[str]
    estado: str
    notas: Optional[str]
    creado_en: datetime

    model_config = {"from_attributes": True}


class DeudaInformalCreate(BaseModel):
    acreedor_nombre: str
    monto_original: Decimal
    fecha_deuda: date
    fecha_prometida: Optional[date] = None
    descripcion: Optional[str] = None
    notas: Optional[str] = None


class DeudaInformalResponse(BaseModel):
    id: uuid.UUID
    acreedor_nombre: str
    monto_original: Decimal
    monto_pagado: Decimal
    saldo_pendiente: Decimal
    fecha_deuda: date
    fecha_prometida: Optional[date]
    descripcion: Optional[str]
    estado: str
    notas: Optional[str]
    creado_en: datetime

    model_config = {"from_attributes": True}
