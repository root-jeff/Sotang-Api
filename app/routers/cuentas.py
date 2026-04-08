import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.usuario import Usuario
from app.schemas.cuenta import (
    CuentaCreate, CuentaUpdate, CuentaResponse,
    CupoGrupoCreate, CupoGrupoResponse,
    TarjetaConfigCreate,
)
from app.services import cuenta_service

router = APIRouter()


@router.get("/", response_model=List[CuentaResponse])
def list_cuentas(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return cuenta_service.get_all(db, current_user.id)


@router.post("/", response_model=CuentaResponse, status_code=201)
def create_cuenta(
    data: CuentaCreate,
    tarjeta: Optional[TarjetaConfigCreate] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return cuenta_service.create(db, current_user.id, data, tarjeta)


@router.get("/{cuenta_id}", response_model=CuentaResponse)
def get_cuenta(cuenta_id: uuid.UUID, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return cuenta_service.get_by_id(db, cuenta_id, current_user.id)


@router.patch("/{cuenta_id}", response_model=CuentaResponse)
def update_cuenta(cuenta_id: uuid.UUID, data: CuentaUpdate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return cuenta_service.update(db, cuenta_id, current_user.id, data)


@router.delete("/{cuenta_id}", status_code=204)
def deactivate_cuenta(cuenta_id: uuid.UUID, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    cuenta_service.deactivate(db, cuenta_id, current_user.id)


@router.get("/{cuenta_id}/cupo-disponible")
def cupo_disponible(cuenta_id: uuid.UUID, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return {"cupo_disponible": cuenta_service.get_cupo_disponible(db, cuenta_id)}


# ── Cupos Grupos ───────────────────────────────────────────────────────────────

@router.get("/cupos-grupos/", response_model=List[CupoGrupoResponse])
def list_cupos_grupos(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return cuenta_service.get_cupos_grupos(db, current_user.id)


@router.post("/cupos-grupos/", response_model=CupoGrupoResponse, status_code=201)
def create_cupo_grupo(data: CupoGrupoCreate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return cuenta_service.create_cupo_grupo(db, current_user.id, data)
