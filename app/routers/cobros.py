import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.usuario import Usuario
from app.schemas.cobros import (
    CuentaCobrarCreate, CuentaCobrarResponse,
    DeudaInformalCreate, DeudaInformalResponse,
    AbonoCreate,
)
from app.services import cobros_service

router = APIRouter()


@router.get("/por-cobrar", response_model=List[CuentaCobrarResponse])
def list_cobrar(
    estado: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return cobros_service.get_cobrar(db, current_user.id, estado)


@router.post("/por-cobrar", response_model=CuentaCobrarResponse, status_code=201)
def create_cobrar(data: CuentaCobrarCreate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return cobros_service.create_cobrar(db, current_user.id, data)


@router.post("/por-cobrar/{cobrar_id}/abono", response_model=CuentaCobrarResponse)
def abonar_cobrar(cobrar_id: uuid.UUID, data: AbonoCreate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return cobros_service.abonar_cobrar(db, cobrar_id, current_user.id, data)


@router.get("/deudas", response_model=List[DeudaInformalResponse])
def list_deudas(
    estado: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return cobros_service.get_deudas(db, current_user.id, estado)


@router.post("/deudas", response_model=DeudaInformalResponse, status_code=201)
def create_deuda(data: DeudaInformalCreate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return cobros_service.create_deuda(db, current_user.id, data)


@router.post("/deudas/{deuda_id}/abono", response_model=DeudaInformalResponse)
def abonar_deuda(deuda_id: uuid.UUID, data: AbonoCreate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return cobros_service.abonar_deuda(db, deuda_id, current_user.id, data)
