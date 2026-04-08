import uuid
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.usuario import Usuario
from app.schemas.transaccion import TransaccionCreate, TransaccionUpdate, TransaccionResponse
from app.services import transaccion_service

router = APIRouter()


@router.get("/", response_model=List[TransaccionResponse])
def list_transacciones(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    cuenta_id: Optional[uuid.UUID] = Query(None),
    categoria_id: Optional[uuid.UUID] = Query(None),
    tipo: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
):
    return transaccion_service.get_all(
        db, current_user.id,
        fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
        cuenta_id=cuenta_id, categoria_id=categoria_id,
        tipo=tipo, estado=estado,
        limit=limit, offset=offset,
    )


@router.post("/", response_model=TransaccionResponse, status_code=201)
def create_transaccion(
    data: TransaccionCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    iva_pct = current_user.settings.iva_porcentaje if current_user.settings else 15.0
    from decimal import Decimal
    return transaccion_service.create(db, current_user.id, data, Decimal(str(iva_pct)))


@router.get("/{txn_id}", response_model=TransaccionResponse)
def get_transaccion(txn_id: uuid.UUID, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return transaccion_service.get_by_id(db, txn_id, current_user.id)


@router.patch("/{txn_id}", response_model=TransaccionResponse)
def update_transaccion(txn_id: uuid.UUID, data: TransaccionUpdate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return transaccion_service.update(db, txn_id, current_user.id, data)


@router.delete("/{txn_id}", status_code=204)
def anular_transaccion(txn_id: uuid.UUID, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    transaccion_service.anular(db, txn_id, current_user.id)
