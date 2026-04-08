from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal
from typing import List
from uuid import UUID

from sqlalchemy import case, extract, func
from sqlalchemy.orm import Session

from app.models.cuenta import Cuenta
from app.models.transaccion import Categoria, Transaccion
from app.schemas.dashboard import FlujoPunto, GastoCategoria, ResumenMes


def get_resumen(db: Session, usuario_id: UUID, mes: int, anio: int) -> ResumenMes:
    primer_dia = date(anio, mes, 1)
    ultimo_dia = date(anio, mes, monthrange(anio, mes)[1])

    def _sum_tipo(tipo: str) -> Decimal:
        result = db.query(func.coalesce(func.sum(Transaccion.monto), 0)).filter(
            Transaccion.usuario_id == usuario_id,
            Transaccion.tipo == tipo,
            Transaccion.estado == "completada",
            Transaccion.fecha >= primer_dia,
            Transaccion.fecha <= ultimo_dia,
        ).scalar()
        return Decimal(str(result))

    ingresos = _sum_tipo("ingreso")
    gastos = _sum_tipo("gasto")
    balance = ingresos - gastos

    liquidez = db.query(func.coalesce(func.sum(Cuenta.saldo_actual), 0)).filter(
        Cuenta.usuario_id == usuario_id,
        Cuenta.activa == True,
        Cuenta.incluir_en_total == True,
    ).scalar()
    liquidez = Decimal(str(liquidez))

    ahorro_rate = float((balance / ingresos * 100).quantize(Decimal("0.01"))) if ingresos > 0 else 0.0

    return ResumenMes(
        mes=mes,
        anio=anio,
        ingresos=ingresos,
        gastos=gastos,
        balance=balance,
        liquidez_total=liquidez,
        ahorro_rate=ahorro_rate,
    )


def get_flujo_mensual(db: Session, usuario_id: UUID, meses: int = 6) -> List[FlujoPunto]:
    desde = date.today().replace(day=1) - timedelta(days=meses * 30)

    rows = db.query(
        extract("year", Transaccion.fecha).label("anio"),
        extract("month", Transaccion.fecha).label("mes"),
        func.sum(
            case((Transaccion.tipo == "ingreso", Transaccion.monto), else_=Decimal("0"))
        ).label("ingresos"),
        func.sum(
            case((Transaccion.tipo == "gasto", Transaccion.monto), else_=Decimal("0"))
        ).label("gastos"),
    ).filter(
        Transaccion.usuario_id == usuario_id,
        Transaccion.estado == "completada",
        Transaccion.tipo != "transferencia",
        Transaccion.fecha >= desde,
    ).group_by("anio", "mes").order_by("anio", "mes").all()

    return [
        FlujoPunto(
            anio=int(r.anio),
            mes=int(r.mes),
            ingresos=Decimal(str(r.ingresos)),
            gastos=Decimal(str(r.gastos)),
            balance=Decimal(str(r.ingresos)) - Decimal(str(r.gastos)),
        )
        for r in rows
    ]


def get_gastos_por_categoria(
    db: Session,
    usuario_id: UUID,
    fecha_desde: date,
    fecha_hasta: date,
) -> List[GastoCategoria]:
    rows = db.query(
        Categoria.id,
        Categoria.nombre,
        Categoria.color,
        func.sum(Transaccion.monto).label("total"),
    ).join(Transaccion, Transaccion.categoria_id == Categoria.id).filter(
        Transaccion.usuario_id == usuario_id,
        Transaccion.tipo == "gasto",
        Transaccion.estado == "completada",
        Transaccion.fecha >= fecha_desde,
        Transaccion.fecha <= fecha_hasta,
    ).group_by(Categoria.id, Categoria.nombre, Categoria.color).order_by(
        func.sum(Transaccion.monto).desc()
    ).all()

    total_general = sum(Decimal(str(r.total)) for r in rows)

    return [
        GastoCategoria(
            categoria_id=str(r.id),
            categoria_nombre=r.nombre,
            color=r.color,
            total=Decimal(str(r.total)),
            porcentaje=float((Decimal(str(r.total)) / total_general * 100).quantize(Decimal("0.01"))) if total_general > 0 else 0.0,
        )
        for r in rows
    ]
