import uuid
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.usuario import Usuario
from app.schemas.transaccion import CategoriaCreate, CategoriaResponse
from app.services import categoria_service

router = APIRouter()


@router.get("/", response_model=List[CategoriaResponse])
def list_categorias(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return categoria_service.get_all(db, current_user.id)


@router.post("/", response_model=CategoriaResponse, status_code=201)
def create_categoria(data: CategoriaCreate, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return categoria_service.create(db, current_user.id, data)


@router.delete("/{categoria_id}", status_code=204)
def deactivate_categoria(categoria_id: uuid.UUID, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    categoria_service.deactivate(db, categoria_id, current_user.id)
