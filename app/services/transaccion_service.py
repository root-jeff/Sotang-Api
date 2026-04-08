from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app.models.cuenta import Cuenta
from app.models.transaccion import Categoria, Etiqueta, Transaccion, TransaccionRecurrente
from app.schemas.transaccion import TransaccionCreate, TransaccionUpdate
from app.services.cuenta_service import delta_saldo


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_or_404(db: Session, txn_id: UUID, usuario_id: UUID) -> Transaccion:
    txn = db.query(Transaccion).filter(
        Transaccion.id == txn_id,
        Transaccion.usuario_id == usuario_id,
    ).first()
    if not txn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transacción no encontrada")
    return txn


def _calcular_iva(monto: Decimal, iva_pct: Decimal) -> tuple[Decimal, Decimal]:
    """
    El monto ingresado ya incluye IVA.
    monto_sin_iva = monto / (1 + iva_pct/100)
    """
    factor = Decimal("1") + iva_pct / Decimal("100")
    monto_sin_iva = (monto / factor).quantize(Decimal("0.01"))
    iva_monto = (monto - monto_sin_iva).quantize(Decimal("0.01"))
    return monto_sin_iva, iva_monto


def _aplicar_efecto_saldo(db: Session, txn: Transaccion) -> None:
    """Aplica el efecto de la transacción en saldo_actual de las cuentas."""
    if txn.tipo == "ingreso":
        delta_saldo(db, txn.cuenta_id, txn.monto)
    elif txn.tipo == "gasto":
        delta_saldo(db, txn.cuenta_id, -txn.monto)
    elif txn.tipo == "transferencia" and txn.cuenta_destino_id:
        delta_saldo(db, txn.cuenta_id, -txn.monto)
        delta_saldo(db, txn.cuenta_destino_id, txn.monto)


def _revertir_efecto_saldo(db: Session, txn: Transaccion) -> None:
    """Revierte el efecto de una transacción (para anulaciones)."""
    if txn.tipo == "ingreso":
        delta_saldo(db, txn.cuenta_id, -txn.monto)
    elif txn.tipo == "gasto":
        delta_saldo(db, txn.cuenta_id, txn.monto)
    elif txn.tipo == "transferencia" and txn.cuenta_destino_id:
        delta_saldo(db, txn.cuenta_id, txn.monto)
        delta_saldo(db, txn.cuenta_destino_id, -txn.monto)


# ── CRUD ───────────────────────────────────────────────────────────────────────

def get_all(
    db: Session,
    usuario_id: UUID,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    cuenta_id: Optional[UUID] = None,
    categoria_id: Optional[UUID] = None,
    tipo: Optional[str] = None,
    estado: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Transaccion]:
    q = db.query(Transaccion).filter(Transaccion.usuario_id == usuario_id)

    if fecha_desde:
        q = q.filter(Transaccion.fecha >= fecha_desde)
    if fecha_hasta:
        q = q.filter(Transaccion.fecha <= fecha_hasta)
    if cuenta_id:
        q = q.filter(Transaccion.cuenta_id == cuenta_id)
    if categoria_id:
        q = q.filter(Transaccion.categoria_id == categoria_id)
    if tipo:
        q = q.filter(Transaccion.tipo == tipo)
    if estado:
        q = q.filter(Transaccion.estado == estado)

    return q.order_by(Transaccion.fecha.desc(), Transaccion.creado_en.desc()).offset(offset).limit(limit).all()


def get_by_id(db: Session, txn_id: UUID, usuario_id: UUID) -> Transaccion:
    return _get_or_404(db, txn_id, usuario_id)


def create(db: Session, usuario_id: UUID, data: TransaccionCreate, iva_pct: Decimal = Decimal("15.00")) -> Transaccion:
    # Calcular IVA si aplica
    monto_sin_iva = None
    iva_monto = None
    if data.incluye_iva:
        monto_sin_iva, iva_monto = _calcular_iva(data.monto, iva_pct)

    txn = Transaccion(
        usuario_id=usuario_id,
        tipo=data.tipo,
        monto=data.monto,
        monto_sin_iva=monto_sin_iva,
        iva_monto=iva_monto,
        incluye_iva=data.incluye_iva,
        categoria_id=data.categoria_id,
        cuenta_id=data.cuenta_id,
        cuenta_destino_id=data.cuenta_destino_id,
        descripcion=data.descripcion,
        fecha=data.fecha,
        canal=data.canal,
        notas=data.notas,
        estado="completada",
    )
    db.add(txn)
    db.flush()  # para tener txn.id

    # Asignar etiquetas
    if data.etiqueta_ids:
        etiquetas = db.query(Etiqueta).filter(
            Etiqueta.id.in_(data.etiqueta_ids),
            Etiqueta.usuario_id == usuario_id,
        ).all()
        txn.etiquetas = etiquetas

    # Actualizar saldos
    _aplicar_efecto_saldo(db, txn)

    db.commit()
    db.refresh(txn)
    return txn


def update(db: Session, txn_id: UUID, usuario_id: UUID, data: TransaccionUpdate) -> Transaccion:
    txn = _get_or_404(db, txn_id, usuario_id)

    if txn.estado == "anulada":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede modificar una transacción anulada",
        )

    update_data = data.model_dump(exclude_unset=True)

    # Si se actualizan etiquetas, manejar por separado
    etiqueta_ids = update_data.pop("etiqueta_ids", None)
    if etiqueta_ids is not None:
        etiquetas = db.query(Etiqueta).filter(
            Etiqueta.id.in_(etiqueta_ids),
            Etiqueta.usuario_id == usuario_id,
        ).all()
        txn.etiquetas = etiquetas

    for field, value in update_data.items():
        setattr(txn, field, value)

    db.commit()
    db.refresh(txn)
    return txn


def anular(db: Session, txn_id: UUID, usuario_id: UUID) -> None:
    txn = _get_or_404(db, txn_id, usuario_id)

    if txn.estado == "anulada":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La transacción ya está anulada",
        )

    # Revertir efecto en saldos antes de anular
    _revertir_efecto_saldo(db, txn)
    txn.estado = "anulada"
    db.commit()
