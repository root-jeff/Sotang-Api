import uuid
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.usuario import Usuario
from app.schemas.presupuesto import MetaAhorroCreate, MetaAhorroUpdate, MetaAhorroResponse, AporteMetaRequest
from app.services import meta_service

router = APIRouter()


@router.get("/", response_model=List[MetaAhorroResponse])
def list_metas(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return meta_service.get_all(db, current_user.id)


@router.post("/", response_model=MetaAhorroResponse, status_code=201)
def create_meta(data: MetaAhorroCreate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return meta_service.create(db, current_user.id, data)


@router.patch("/{meta_id}", response_model=MetaAhorroResponse)
def update_meta(meta_id: uuid.UUID, data: MetaAhorroUpdate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return meta_service.update(db, meta_id, current_user.id, data)


@router.post("/{meta_id}/aportar", response_model=MetaAhorroResponse)
def aportar(meta_id: uuid.UUID, data: AporteMetaRequest, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return meta_service.aportar(db, meta_id, current_user.id, data)
