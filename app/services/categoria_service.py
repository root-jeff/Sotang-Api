from typing import List
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.transaccion import Categoria
from app.schemas.transaccion import CategoriaCreate


def get_all(db: Session, usuario_id: UUID) -> List[Categoria]:
    """Retorna categorías del sistema (usuario_id IS NULL) + las del usuario."""
    return db.query(Categoria).filter(
        (Categoria.usuario_id == usuario_id) | (Categoria.usuario_id == None),
        Categoria.activa == True,
    ).order_by(Categoria.orden, Categoria.nombre).all()


def create(db: Session, usuario_id: UUID, data: CategoriaCreate) -> Categoria:
    # Validar que el parent existe y pertenece al usuario (o es del sistema)
    if data.parent_id:
        parent = db.query(Categoria).filter(Categoria.id == data.parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Categoría padre no encontrada")
        if parent.parent_id is not None:
            raise HTTPException(
                status_code=400,
                detail="No se puede crear una subcategoría de una subcategoría (máximo 2 niveles)",
            )

    cat = Categoria(
        usuario_id=usuario_id,
        nombre=data.nombre,
        tipo=data.tipo,
        color=data.color,
        icono=data.icono,
        parent_id=data.parent_id,
        orden=data.orden,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


def deactivate(db: Session, categoria_id: UUID, usuario_id: UUID) -> None:
    cat = db.query(Categoria).filter(Categoria.id == categoria_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    if cat.es_sistema:
        raise HTTPException(status_code=403, detail="Las categorías del sistema no pueden eliminarse")
    if cat.usuario_id != usuario_id:
        raise HTTPException(status_code=403, detail="No tienes permiso para eliminar esta categoría")
    cat.activa = False
    db.commit()
