from decimal import Decimal
from typing import List
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.cuenta import Cuenta
from app.models.presupuesto import MetaAhorro
from app.schemas.presupuesto import MetaAhorroCreate, MetaAhorroUpdate, MetaAhorroResponse, AporteMetaRequest


def _enrich(meta: MetaAhorro) -> MetaAhorroResponse:
    resp = MetaAhorroResponse.model_validate(meta)
    if meta.monto_objetivo > 0:
        resp.porcentaje = float((meta.monto_actual / meta.monto_objetivo * 100).quantize(Decimal("0.01")))
    resp.monto_faltante = max(Decimal("0"), meta.monto_objetivo - meta.monto_actual)
    return resp


def get_all(db: Session, usuario_id: UUID) -> List[MetaAhorroResponse]:
    metas = db.query(MetaAhorro).filter(
        MetaAhorro.usuario_id == usuario_id,
        MetaAhorro.activa == True,
    ).order_by(MetaAhorro.prioridad, MetaAhorro.nombre).all()
    return [_enrich(m) for m in metas]


def create(db: Session, usuario_id: UUID, data: MetaAhorroCreate) -> MetaAhorroResponse:
    meta = MetaAhorro(usuario_id=usuario_id, **data.model_dump())
    db.add(meta)
    db.commit()
    db.refresh(meta)
    return _enrich(meta)


def update(db: Session, meta_id: UUID, usuario_id: UUID, data: MetaAhorroUpdate) -> MetaAhorroResponse:
    meta = db.query(MetaAhorro).filter(MetaAhorro.id == meta_id, MetaAhorro.usuario_id == usuario_id).first()
    if not meta:
        raise HTTPException(status_code=404, detail="Meta no encontrada")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(meta, field, value)
    db.commit()
    db.refresh(meta)
    return _enrich(meta)


def aportar(db: Session, meta_id: UUID, usuario_id: UUID, data: AporteMetaRequest) -> MetaAhorroResponse:
    meta = db.query(MetaAhorro).filter(MetaAhorro.id == meta_id, MetaAhorro.usuario_id == usuario_id).first()
    if not meta:
        raise HTTPException(status_code=404, detail="Meta no encontrada")
    if meta.tipo != "libre":
        raise HTTPException(status_code=400, detail="Solo las metas tipo 'libre' aceptan aportes manuales")
    if meta.completada:
        raise HTTPException(status_code=400, detail="La meta ya está completada")

    nuevo_monto = meta.monto_actual + data.monto
    if nuevo_monto >= meta.monto_objetivo:
        from datetime import date
        meta.monto_actual = meta.monto_objetivo
        meta.completada = True
        meta.fecha_completada = date.today()
    else:
        meta.monto_actual = nuevo_monto

    db.commit()
    db.refresh(meta)
    return _enrich(meta)


def sync_desde_cuenta(db: Session, meta: MetaAhorro) -> None:
    """Sincroniza monto_actual desde la cuenta vinculada (para tipo != libre)."""
    if meta.tipo in ("cuenta_virtual", "cuenta_especifica") and meta.cuenta_id:
        cuenta = db.query(Cuenta).filter(Cuenta.id == meta.cuenta_id).first()
        if cuenta:
            from datetime import date
            meta.monto_actual = min(cuenta.saldo_actual, meta.monto_objetivo)
            if meta.monto_actual >= meta.monto_objetivo:
                meta.completada = True
                meta.fecha_completada = date.today()
            db.commit()
