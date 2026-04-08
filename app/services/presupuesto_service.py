from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal
from typing import List, Optional, Tuple
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.presupuesto import Presupuesto
from app.models.transaccion import Transaccion
from app.schemas.presupuesto import PresupuestoCreate, PresupuestoUpdate, PresupuestoResponse


def _rango_periodo(periodo: str, fecha_inicio=None, fecha_fin=None) -> Tuple[date, date]:
    today = date.today()
    if periodo == "mensual":
        start = today.replace(day=1)
        end = today.replace(day=monthrange(today.year, today.month)[1])
    elif periodo == "semanal":
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=6)
    elif periodo == "anual":
        start = today.replace(month=1, day=1)
        end = today.replace(month=12, day=31)
    else:  # personalizado
        start, end = fecha_inicio, fecha_fin
    return start, end


def get_all(db: Session, usuario_id: UUID) -> List[PresupuestoResponse]:
    presupuestos = db.query(Presupuesto).filter(
        Presupuesto.usuario_id == usuario_id,
        Presupuesto.activo == True,
    ).all()

    result = []
    for p in presupuestos:
        start, end = _rango_periodo(p.periodo, p.fecha_inicio, p.fecha_fin)

        gastado = db.query(func.coalesce(func.sum(Transaccion.monto), 0)).filter(
            Transaccion.usuario_id == usuario_id,
            Transaccion.categoria_id == p.categoria_id,
            Transaccion.tipo == "gasto",
            Transaccion.estado == "completada",
            Transaccion.fecha >= start,
            Transaccion.fecha <= end,
        ).scalar() or Decimal("0")

        gastado = Decimal(str(gastado))
        gastado_pct = float((gastado / p.monto * 100).quantize(Decimal("0.01"))) if p.monto > 0 else 0.0
        disponible = p.monto - gastado

        resp = PresupuestoResponse.model_validate(p)
        resp.gastado = gastado
        resp.gastado_pct = gastado_pct
        resp.disponible = disponible
        result.append(resp)

    return result


def create(db: Session, usuario_id: UUID, data: PresupuestoCreate) -> Presupuesto:
    p = Presupuesto(
        usuario_id=usuario_id,
        categoria_id=data.categoria_id,
        monto=data.monto,
        periodo=data.periodo,
        fecha_inicio=data.fecha_inicio,
        fecha_fin=data.fecha_fin,
        alerta_porcentaje=data.alerta_porcentaje,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def update(db: Session, presupuesto_id: UUID, usuario_id: UUID, data: PresupuestoUpdate) -> Presupuesto:
    p = db.query(Presupuesto).filter(
        Presupuesto.id == presupuesto_id,
        Presupuesto.usuario_id == usuario_id,
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(p, field, value)
    db.commit()
    db.refresh(p)
    return p
