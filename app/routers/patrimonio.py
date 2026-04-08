import uuid
from typing import List
from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
import json

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.usuario import Usuario
from app.schemas.patrimonio import (
    ActivoCreate, ActivoUpdate, ActivoResponse,
    PasivoCreate, PasivoResponse,
    NetWorthResponse, EquifaxResponse,
)
from app.services import patrimonio_service

router = APIRouter()


@router.get("/net-worth", response_model=NetWorthResponse)
def net_worth(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return patrimonio_service.get_net_worth(db, current_user.id)


@router.get("/activos", response_model=List[ActivoResponse])
def list_activos(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return patrimonio_service.get_activos(db, current_user.id)


@router.post("/activos", response_model=ActivoResponse, status_code=201)
def create_activo(data: ActivoCreate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return patrimonio_service.create_activo(db, current_user.id, data)


@router.patch("/activos/{activo_id}", response_model=ActivoResponse)
def update_activo(activo_id: uuid.UUID, data: ActivoUpdate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return patrimonio_service.update_activo(db, activo_id, current_user.id, data)


@router.get("/pasivos", response_model=List[PasivoResponse])
def list_pasivos(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return patrimonio_service.get_pasivos(db, current_user.id)


@router.post("/pasivos", response_model=PasivoResponse, status_code=201)
def create_pasivo(data: PasivoCreate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return patrimonio_service.create_pasivo(db, current_user.id, data)


@router.get("/equifax", response_model=List[EquifaxResponse])
def list_equifax(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return patrimonio_service.get_equifax_historial(db, current_user.id)


@router.post("/equifax/upload", response_model=EquifaxResponse, status_code=201)
async def upload_equifax(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    content = await file.read()
    raw = json.loads(content)
    return patrimonio_service.upload_equifax(db, current_user.id, raw)
