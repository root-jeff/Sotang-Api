from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.usuario import Usuario
from app.schemas.dashboard import ResumenMes, FlujoPunto, GastoCategoria
from app.services import dashboard_service

router = APIRouter()


@router.get("/resumen", response_model=ResumenMes)
def get_resumen(
    mes: Optional[int] = Query(None, ge=1, le=12),
    anio: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    hoy = date.today()
    return dashboard_service.get_resumen(
        db, current_user.id,
        mes=mes or hoy.month,
        anio=anio or hoy.year,
    )


@router.get("/flujo-mensual", response_model=List[FlujoPunto])
def get_flujo_mensual(
    meses: int = Query(6, ge=1, le=24),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return dashboard_service.get_flujo_mensual(db, current_user.id, meses)


@router.get("/gastos-por-categoria", response_model=List[GastoCategoria])
def get_gastos_categoria(
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    hoy = date.today()
    return dashboard_service.get_gastos_por_categoria(
        db, current_user.id,
        fecha_desde=fecha_desde or hoy.replace(day=1),
        fecha_hasta=fecha_hasta or hoy,
    )
