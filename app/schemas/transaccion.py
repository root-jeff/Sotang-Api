import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, model_validator


class TransaccionCreate(BaseModel):
    tipo: str                          # ingreso | gasto | transferencia
    monto: Decimal
    categoria_id: uuid.UUID
    cuenta_id: uuid.UUID
    cuenta_destino_id: Optional[uuid.UUID] = None
    descripcion: Optional[str] = None
    fecha: date
    canal: str = "web"
    incluye_iva: bool = False
    notas: Optional[str] = None
    etiqueta_ids: List[uuid.UUID] = []

    @model_validator(mode="after")
    def validate_transferencia(self):
        if self.tipo == "transferencia" and not self.cuenta_destino_id:
            raise ValueError("Las transferencias requieren cuenta_destino_id")
        return self


class TransaccionUpdate(BaseModel):
    descripcion: Optional[str] = None
    notas: Optional[str] = None
    categoria_id: Optional[uuid.UUID] = None
    fecha: Optional[date] = None
    estado: Optional[str] = None
    etiqueta_ids: Optional[List[uuid.UUID]] = None


class TransaccionResponse(BaseModel):
    id: uuid.UUID
    tipo: str
    monto: Decimal
    monto_sin_iva: Optional[Decimal]
    iva_monto: Optional[Decimal]
    incluye_iva: bool
    categoria_id: uuid.UUID
    cuenta_id: uuid.UUID
    cuenta_destino_id: Optional[uuid.UUID]
    descripcion: Optional[str]
    fecha: date
    canal: str
    estado: str
    notas: Optional[str]
    creado_en: datetime

    model_config = {"from_attributes": True}


class CategoriaCreate(BaseModel):
    nombre: str
    tipo: str   # ingreso | gasto | ambos
    color: str = "#6366f1"
    icono: Optional[str] = None
    parent_id: Optional[uuid.UUID] = None
    orden: int = 0


class CategoriaResponse(BaseModel):
    id: uuid.UUID
    nombre: str
    tipo: str
    color: str
    icono: Optional[str]
    es_sistema: bool
    parent_id: Optional[uuid.UUID]
    orden: int

    model_config = {"from_attributes": True}
