import uuid
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.usuario import Usuario
from app.schemas.presupuesto import PresupuestoCreate, PresupuestoUpdate, PresupuestoResponse
from app.services import presupuesto_service

router = APIRouter()


@router.get("/", response_model=List[PresupuestoResponse])
def list_presupuestos(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return presupuesto_service.get_all(db, current_user.id)


@router.post("/", status_code=201)
def create_presupuesto(data: PresupuestoCreate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return presupuesto_service.create(db, current_user.id, data)


@router.patch("/{presupuesto_id}")
def update_presupuesto(presupuesto_id: uuid.UUID, data: PresupuestoUpdate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return presupuesto_service.update(db, presupuesto_id, current_user.id, data)
