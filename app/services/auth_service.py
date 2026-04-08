from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    hash_refresh_token,
)
from app.core.config import settings
from app.models.usuario import Usuario, UserSettings, NotificationPreference, RefreshToken
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse


# ── Eventos de notificación default ───────────────────────────────────────────
NOTIF_EVENTOS_DEFAULT = [
    "recurrente_dia_antes",
    "corte_tarjeta_dia_antes",
    "meta_completada",
    "meta_progreso",
    "presupuesto_alerta",
    "presupuesto_excedido",
    "deuda_vencida",
    "cuenta_cobrar_recordatorio",
    "backup_fallido",
    "crypto_precio_error",
]


def register(db: Session, data: RegisterRequest) -> Usuario:
    # Verificar email único
    existing = db.query(Usuario).filter(Usuario.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe una cuenta con ese email",
        )

    user = Usuario(
        nombre=data.nombre,
        email=data.email,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    db.flush()  # Para tener el user.id antes del commit

    # Crear settings default
    db.add(UserSettings(usuario_id=user.id))

    # Crear preferencias de notificación default (todos los eventos activados)
    for evento in NOTIF_EVENTOS_DEFAULT:
        db.add(NotificationPreference(usuario_id=user.id, evento=evento))

    db.commit()
    db.refresh(user)
    return user


def login(db: Session, data: LoginRequest, ip: Optional[str] = None, user_agent: Optional[str] = None) -> dict:
    user = db.query(Usuario).filter(
        Usuario.email == data.email,
        Usuario.activo == True,
    ).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )

    # Generar tokens
    access_token = create_access_token(str(user.id))
    refresh_raw, refresh_hash = create_refresh_token()

    # Guardar refresh token en DB
    expira_en = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    db.add(RefreshToken(
        usuario_id=user.id,
        token_hash=refresh_hash,
        expira_en=expira_en,
        ip_address=ip,
        user_agent=user_agent,
    ))

    # Actualizar último login
    user.ultimo_login = datetime.now(timezone.utc)
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_raw,
        "token_type": "bearer",
    }


def refresh_access_token(db: Session, refresh_raw: str) -> dict:
    token_hash = hash_refresh_token(refresh_raw)

    rt = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash,
        RefreshToken.revocado == False,
        RefreshToken.expira_en > datetime.now(timezone.utc),
    ).first()

    if not rt:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido o expirado",
        )

    user = db.query(Usuario).filter(
        Usuario.id == rt.usuario_id,
        Usuario.activo == True,
    ).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")

    # Rotar: revocar el anterior y emitir uno nuevo
    rt.revocado = True
    new_access = create_access_token(str(user.id))
    new_raw, new_hash = create_refresh_token()

    expira_en = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    db.add(RefreshToken(
        usuario_id=user.id,
        token_hash=new_hash,
        expira_en=expira_en,
    ))
    db.commit()

    return {"access_token": new_access, "refresh_token": new_raw, "token_type": "bearer"}


def logout(db: Session, refresh_raw: str) -> None:
    token_hash = hash_refresh_token(refresh_raw)
    rt = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    if rt:
        rt.revocado = True
        db.commit()
