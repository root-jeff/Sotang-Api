import json
from datetime import date
from decimal import Decimal
from typing import List
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.cuenta import Cuenta
from app.models.patrimonio import Activo, EquifaxReporte, Pasivo
from app.schemas.patrimonio import (
    ActivoCreate, ActivoUpdate,
    PasivoCreate,
    NetWorthResponse,
)


# ── Activos ────────────────────────────────────────────────────────────────────

def get_activos(db: Session, usuario_id: UUID) -> List[Activo]:
    return db.query(Activo).filter(Activo.usuario_id == usuario_id, Activo.activo == True).all()


def create_activo(db: Session, usuario_id: UUID, data: ActivoCreate) -> Activo:
    activo = Activo(
        usuario_id=usuario_id,
        ultima_valoracion=date.today(),
        **data.model_dump(),
    )
    db.add(activo)
    db.commit()
    db.refresh(activo)
    return activo


def update_activo(db: Session, activo_id: UUID, usuario_id: UUID, data: ActivoUpdate) -> Activo:
    activo = db.query(Activo).filter(Activo.id == activo_id, Activo.usuario_id == usuario_id).first()
    if not activo:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(activo, field, value)
    activo.ultima_valoracion = date.today()
    db.commit()
    db.refresh(activo)
    return activo


# ── Pasivos ────────────────────────────────────────────────────────────────────

def get_pasivos(db: Session, usuario_id: UUID) -> List[Pasivo]:
    return db.query(Pasivo).filter(Pasivo.usuario_id == usuario_id, Pasivo.activo == True).all()


def create_pasivo(db: Session, usuario_id: UUID, data: PasivoCreate) -> Pasivo:
    pasivo = Pasivo(usuario_id=usuario_id, **data.model_dump())
    db.add(pasivo)
    db.commit()
    db.refresh(pasivo)
    return pasivo


# ── Net Worth ──────────────────────────────────────────────────────────────────

def get_net_worth(db: Session, usuario_id: UUID) -> NetWorthResponse:
    # Activos líquidos: suma de cuentas activas con incluir_en_total=True
    activos_liquidos = db.query(func.coalesce(func.sum(Cuenta.saldo_actual), 0)).filter(
        Cuenta.usuario_id == usuario_id,
        Cuenta.activa == True,
        Cuenta.incluir_en_total == True,
    ).scalar() or Decimal("0")

    # Activos físicos: vehículos, inmuebles, etc.
    activos_fisicos = db.query(func.coalesce(func.sum(Activo.valor_actual), 0)).filter(
        Activo.usuario_id == usuario_id,
        Activo.activo == True,
    ).scalar() or Decimal("0")

    # Pasivos
    total_pasivos = db.query(func.coalesce(func.sum(Pasivo.saldo_pendiente), 0)).filter(
        Pasivo.usuario_id == usuario_id,
        Pasivo.activo == True,
    ).scalar() or Decimal("0")

    activos_liquidos = Decimal(str(activos_liquidos))
    activos_fisicos = Decimal(str(activos_fisicos))
    total_pasivos = Decimal(str(total_pasivos))
    total_activos = activos_liquidos + activos_fisicos

    return NetWorthResponse(
        activos_liquidos=activos_liquidos,
        activos_fisicos=activos_fisicos,
        total_activos=total_activos,
        total_pasivos=total_pasivos,
        net_worth=total_activos - total_pasivos,
    )


# ── Equifax ────────────────────────────────────────────────────────────────────

def get_equifax_historial(db: Session, usuario_id: UUID) -> List[EquifaxReporte]:
    return db.query(EquifaxReporte).filter(
        EquifaxReporte.usuario_id == usuario_id,
    ).order_by(EquifaxReporte.fecha_consulta.desc()).all()


def upload_equifax(db: Session, usuario_id: UUID, raw: dict) -> EquifaxReporte:
    transaction_id = raw.get("transactionId") or raw.get("transaction_id")
    if not transaction_id:
        raise HTTPException(status_code=400, detail="JSON de Equifax sin transactionId")

    # Evitar duplicados
    existing = db.query(EquifaxReporte).filter(
        EquifaxReporte.usuario_id == usuario_id,
        EquifaxReporte.equifax_transaction_id == str(transaction_id),
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Este reporte ya fue importado")

    reporte_crediticio = raw.get("reporteCrediticio", {})
    scores = reporte_crediticio.get("score", [{}])
    score_inclusion = reporte_crediticio.get("score_inclusion", [{}])

    reporte = EquifaxReporte(
        usuario_id=usuario_id,
        equifax_transaction_id=str(transaction_id),
        score_principal=scores[0].get("score") if scores else None,
        score_inclusion=score_inclusion[0].get("score") if score_inclusion else None,
        segmentacion_riesgo=reporte_crediticio.get("segmentacion_riesgo"),
        segmentacion_cliente=reporte_crediticio.get("segmentacion_cliente"),
        modelo_utilizado=reporte_crediticio.get("modelo"),
        capacidad_pago=reporte_crediticio.get("capacidad_pago"),
        nivel_ingresos=reporte_crediticio.get("nivel_ingresos"),
        raw_json=raw,
    )
    db.add(reporte)
    db.commit()
    db.refresh(reporte)
    return reporte
