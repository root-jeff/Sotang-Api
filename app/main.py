from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import (
    auth,
    usuarios,
    cuentas,
    transacciones,
    categorias,
    presupuestos,
    metas,
    patrimonio,
    cobros,
    dashboard,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — agregar init de Celery, Firebase, etc. cuando corresponda
    yield
    # Shutdown


app = FastAPI(
    title="Sotang API",
    description="API de gestión financiera personal — self-hosted en Raspberry Pi 5",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
PREFIX = "/api/v1"

app.include_router(auth.router,           prefix=f"{PREFIX}/auth",          tags=["Auth"])
app.include_router(usuarios.router,       prefix=f"{PREFIX}/usuarios",       tags=["Usuarios"])
app.include_router(cuentas.router,        prefix=f"{PREFIX}/cuentas",        tags=["Cuentas"])
app.include_router(transacciones.router,  prefix=f"{PREFIX}/transacciones",  tags=["Transacciones"])
app.include_router(categorias.router,     prefix=f"{PREFIX}/categorias",     tags=["Categorías"])
app.include_router(presupuestos.router,   prefix=f"{PREFIX}/presupuestos",   tags=["Presupuestos"])
app.include_router(metas.router,          prefix=f"{PREFIX}/metas",          tags=["Metas de Ahorro"])
app.include_router(patrimonio.router,     prefix=f"{PREFIX}/patrimonio",     tags=["Patrimonio"])
app.include_router(cobros.router,         prefix=f"{PREFIX}/cobros",         tags=["Cobros y Deudas"])
app.include_router(dashboard.router,      prefix=f"{PREFIX}/dashboard",      tags=["Dashboard"])


@app.get("/health", tags=["Sistema"])
def health_check():
    return {"status": "ok", "app": "sotang-api", "version": "0.1.0"}
