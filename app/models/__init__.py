# Importar todos los modelos para que SQLAlchemy los registre en el metadata de Base
from app.models.base import Base
from app.models.usuario import Usuario, UserSettings, NotificationPreference, RefreshToken
from app.models.cuenta import Cuenta, CupoGrupo, TarjetaConfig, CriptoConfig, AhorroVirtualConfig
from app.models.transaccion import Categoria, Etiqueta, TransaccionEtiqueta, TransaccionRecurrente, Transaccion
from app.models.presupuesto import Presupuesto, MetaAhorro
from app.models.patrimonio import Activo, Pasivo, EquifaxReporte, CriptoPrecioHistorico
from app.models.cobros import CuentaCobrar, CuentaCobrarAbono, DeudaInformal, DeudaInformalAbono
from app.models.sistema import Adjunto, NotificacionLog, BackupLog

__all__ = [
    "Base",
    "Usuario", "UserSettings", "NotificationPreference", "RefreshToken",
    "Cuenta", "CupoGrupo", "TarjetaConfig", "CriptoConfig", "AhorroVirtualConfig",
    "Categoria", "Etiqueta", "TransaccionEtiqueta", "TransaccionRecurrente", "Transaccion",
    "Presupuesto", "MetaAhorro",
    "Activo", "Pasivo", "EquifaxReporte", "CriptoPrecioHistorico",
    "CuentaCobrar", "CuentaCobrarAbono", "DeudaInformal", "DeudaInformalAbono",
    "Adjunto", "NotificacionLog", "BackupLog",
]
