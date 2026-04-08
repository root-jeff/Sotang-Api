from decimal import Decimal
from typing import List
from pydantic import BaseModel


class ResumenMes(BaseModel):
    mes: int
    anio: int
    ingresos: Decimal
    gastos: Decimal
    balance: Decimal
    liquidez_total: Decimal
    ahorro_rate: float  # balance / ingresos * 100


class FlujoPunto(BaseModel):
    anio: int
    mes: int
    ingresos: Decimal
    gastos: Decimal
    balance: Decimal


class GastoCategoria(BaseModel):
    categoria_id: str
    categoria_nombre: str
    color: str
    total: Decimal
    porcentaje: float
