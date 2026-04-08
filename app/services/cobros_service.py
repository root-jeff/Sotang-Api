from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.cobros import CuentaCobrar, CuentaCobrarAbono, DeudaInformal, DeudaInformalAbono
from app.schemas.cobros import (
    AbonoCreate,
    CuentaCobrarCreate,
    DeudaInformalCreate,
)


def _actualizar_estado_cobrar(cobrar: CuentaCobrar) -> None:
    if cobrar.monto_pagado == 0:
        cobrar.estado = "pendiente"
    elif cobrar.monto_pagado < cobrar.monto_original:
        cobrar.estado = "parcial"
    else:
        cobrar.estado = "cobrado"


def _actualizar_estado_deuda(deuda: DeudaInformal) -> None:
    if deuda.monto_pagado == 0:
        deuda.estado = "pendiente"
    elif deuda.monto_pagado < deuda.monto_original:
        deuda.estado = "parcial"
    else:
        deuda.estado = "pagado"


# ── Cuentas por cobrar ─────────────────────────────────────────────────────────

def get_cobrar(db: Session, usuario_id: UUID, estado: Optional[str] = None) -> List[CuentaCobrar]:
    q = db.query(CuentaCobrar).filter(CuentaCobrar.usuario_id == usuario_id)
    if estado:
        q = q.filter(CuentaCobrar.estado == estado)
    return q.order_by(CuentaCobrar.fecha_prometida.asc().nullslast()).all()


def create_cobrar(db: Session, usuario_id: UUID, data: CuentaCobrarCreate) -> CuentaCobrar:
    cobrar = CuentaCobrar(usuario_id=usuario_id, **data.model_dump())
    db.add(cobrar)
    db.commit()
    db.refresh(cobrar)
    return cobrar


def abonar_cobrar(db: Session, cobrar_id: UUID, usuario_id: UUID, data: AbonoCreate) -> CuentaCobrar:
    cobrar = db.query(CuentaCobrar).filter(
        CuentaCobrar.id == cobrar_id,
        CuentaCobrar.usuario_id == usuario_id,
    ).first()
    if not cobrar:
        raise HTTPException(status_code=404, detail="Cuenta por cobrar no encontrada")
    if cobrar.estado == "cobrado":
        raise HTTPException(status_code=400, detail="Esta deuda ya está saldada")

    # Validar que el abono no exceda el saldo pendiente
    saldo = cobrar.monto_original - cobrar.monto_pagado
    if data.monto > saldo:
        raise HTTPException(
            status_code=400,
            detail=f"El abono ({data.monto}) excede el saldo pendiente ({saldo})",
        )

    abono = CuentaCobrarAbono(
        cuenta_cobrar_id=cobrar_id,
        monto=data.monto,
        fecha=data.fecha,
        notas=data.notas,
    )
    db.add(abono)
    cobrar.monto_pagado += data.monto
    _actualizar_estado_cobrar(cobrar)
    db.commit()
    db.refresh(cobrar)
    return cobrar


# ── Deudas informales ──────────────────────────────────────────────────────────

def get_deudas(db: Session, usuario_id: UUID, estado: Optional[str] = None) -> List[DeudaInformal]:
    q = db.query(DeudaInformal).filter(DeudaInformal.usuario_id == usuario_id)
    if estado:
        q = q.filter(DeudaInformal.estado == estado)
    return q.order_by(DeudaInformal.fecha_prometida.asc().nullslast()).all()


def create_deuda(db: Session, usuario_id: UUID, data: DeudaInformalCreate) -> DeudaInformal:
    deuda = DeudaInformal(usuario_id=usuario_id, **data.model_dump())
    db.add(deuda)
    db.commit()
    db.refresh(deuda)
    return deuda


def abonar_deuda(db: Session, deuda_id: UUID, usuario_id: UUID, data: AbonoCreate) -> DeudaInformal:
    deuda = db.query(DeudaInformal).filter(
        DeudaInformal.id == deuda_id,
        DeudaInformal.usuario_id == usuario_id,
    ).first()
    if not deuda:
        raise HTTPException(status_code=404, detail="Deuda no encontrada")
    if deuda.estado == "pagado":
        raise HTTPException(status_code=400, detail="Esta deuda ya está pagada")

    saldo = deuda.monto_original - deuda.monto_pagado
    if data.monto > saldo:
        raise HTTPException(
            status_code=400,
            detail=f"El abono ({data.monto}) excede el saldo pendiente ({saldo})",
        )

    abono = DeudaInformalAbono(
        deuda_id=deuda_id,
        monto=data.monto,
        fecha=data.fecha,
        notas=data.notas,
    )
    db.add(abono)
    deuda.monto_pagado += data.monto
    _actualizar_estado_deuda(deuda)
    db.commit()
    db.refresh(deuda)
    return deuda
