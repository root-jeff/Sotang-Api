from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models.cuenta import (
    AhorroVirtualConfig,
    Cuenta,
    CriptoConfig,
    CupoGrupo,
    TarjetaConfig,
)
from app.schemas.cuenta import (
    CuentaCreate,
    CuentaUpdate,
    CupoGrupoCreate,
    TarjetaConfigCreate,
)


# ── Helpers internos ───────────────────────────────────────────────────────────

def _get_or_404(db: Session, cuenta_id: UUID, usuario_id: UUID) -> Cuenta:
    cuenta = db.query(Cuenta).filter(
        Cuenta.id == cuenta_id,
        Cuenta.usuario_id == usuario_id,
    ).first()
    if not cuenta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cuenta no encontrada")
    return cuenta


def delta_saldo(db: Session, cuenta_id: UUID, delta: Decimal) -> None:
    """Actualiza saldo_actual de una cuenta de forma atómica."""
    db.execute(
        update(Cuenta)
        .where(Cuenta.id == cuenta_id)
        .values(saldo_actual=Cuenta.saldo_actual + delta)
    )


# ── CRUD ───────────────────────────────────────────────────────────────────────

def get_all(db: Session, usuario_id: UUID, solo_activas: bool = True) -> List[Cuenta]:
    q = db.query(Cuenta).filter(Cuenta.usuario_id == usuario_id)
    if solo_activas:
        q = q.filter(Cuenta.activa == True)
    return q.order_by(Cuenta.orden, Cuenta.nombre).all()


def get_by_id(db: Session, cuenta_id: UUID, usuario_id: UUID) -> Cuenta:
    return _get_or_404(db, cuenta_id, usuario_id)


def create(
    db: Session,
    usuario_id: UUID,
    data: CuentaCreate,
    tarjeta: Optional[TarjetaConfigCreate] = None,
) -> Cuenta:
    cuenta = Cuenta(
        usuario_id=usuario_id,
        nombre=data.nombre,
        tipo=data.tipo,
        moneda=data.moneda,
        saldo_inicial=data.saldo_inicial,
        saldo_actual=data.saldo_inicial,  # saldo inicial = saldo actual al crear
        color=data.color,
        icono=data.icono,
        incluir_en_total=data.incluir_en_total,
        orden=data.orden,
        notas=data.notas,
    )
    db.add(cuenta)
    db.flush()  # para tener cuenta.id

    # Extensiones por tipo
    if data.tipo == "tarjeta_credito" and tarjeta:
        db.add(TarjetaConfig(
            cuenta_id=cuenta.id,
            cupo_total=tarjeta.cupo_total,
            cupo_grupo_id=tarjeta.cupo_grupo_id,
            fecha_corte=tarjeta.fecha_corte,
            fecha_pago=tarjeta.fecha_pago,
            tasa_interes_anual=tarjeta.tasa_interes_anual,
            banco=tarjeta.banco,
            ultimos_4=tarjeta.ultimos_4,
        ))

    db.commit()
    db.refresh(cuenta)
    return cuenta


def update(db: Session, cuenta_id: UUID, usuario_id: UUID, data: CuentaUpdate) -> Cuenta:
    cuenta = _get_or_404(db, cuenta_id, usuario_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(cuenta, field, value)
    db.commit()
    db.refresh(cuenta)
    return cuenta


def deactivate(db: Session, cuenta_id: UUID, usuario_id: UUID) -> None:
    cuenta = _get_or_404(db, cuenta_id, usuario_id)
    cuenta.activa = False
    db.commit()


# ── Cupos Grupos ───────────────────────────────────────────────────────────────

def get_cupos_grupos(db: Session, usuario_id: UUID) -> List[CupoGrupo]:
    return db.query(CupoGrupo).filter(CupoGrupo.usuario_id == usuario_id).all()


def create_cupo_grupo(db: Session, usuario_id: UUID, data: CupoGrupoCreate) -> CupoGrupo:
    grupo = CupoGrupo(usuario_id=usuario_id, nombre=data.nombre, cupo_total=data.cupo_total)
    db.add(grupo)
    db.commit()
    db.refresh(grupo)
    return grupo


# ── Cupo disponible para tarjetas ─────────────────────────────────────────────

def get_cupo_disponible(db: Session, cuenta_id: UUID) -> Decimal:
    """
    Si la tarjeta pertenece a un grupo: cupo_grupo.cupo_total - SUM(saldo_actual de todas las tarjetas del grupo)
    Si no tiene grupo: tarjeta.cupo_total - ABS(cuenta.saldo_actual)
    """
    tc = db.query(TarjetaConfig).filter(TarjetaConfig.cuenta_id == cuenta_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Configuración de tarjeta no encontrada")

    if tc.cupo_grupo_id:
        # Cupo compartido
        grupo = db.query(CupoGrupo).filter(CupoGrupo.id == tc.cupo_grupo_id).first()
        tarjetas_grupo = db.query(TarjetaConfig).filter(TarjetaConfig.cupo_grupo_id == tc.cupo_grupo_id).all()
        ids = [t.cuenta_id for t in tarjetas_grupo]
        cuentas = db.query(Cuenta).filter(Cuenta.id.in_(ids)).all()
        usado = sum(abs(c.saldo_actual) for c in cuentas)
        return grupo.cupo_total - usado
    else:
        cuenta = db.query(Cuenta).filter(Cuenta.id == cuenta_id).first()
        return tc.cupo_total - abs(cuenta.saldo_actual)
