# SoTang API

API REST para gestión de finanzas personales construida con **FastAPI** y **PostgreSQL**.

## Características

- 🔐 Autenticación JWT segura
- 💰 Gestión de cuentas y transacciones
- 📊 Dashboard con análisis financieros
- 📈 Presupuestos y metas de ahorro
- 📝 Categorización de gastos
- 🎯 Gestión de cobros

## Tech Stack

- **Backend**: FastAPI + SQLAlchemy
- **Base de datos**: PostgreSQL
- **Autenticación**: JWT
- **Migraciones**: Alembic
- **Servidor**: Gunicorn + Nginx (Docker)

## Instalación

### Requisitos previos
- Python 3.9+
- PostgreSQL 12+
- pip

### 1. Clonar el repositorio
```bash
git clone <repository>
cd sotang-api
```

### 2. Crear ambiente virtual
```bash
python -m venv venv
# En Windows
venv\Scripts\activate
# En Linux/Mac
source venv/bin/activate
```

### 3. Instalar dependencias
```bash
pip install -r requirements.txt
```

### 4. Configurar variables de entorno
```bash
cp .env.example .env
# Editar .env con tus valores
```

### 5. Aplicar migraciones
```bash
alembic upgrade head
```

### 6. Ejecutar el servidor
```bash
python -m uvicorn app.main:app --reload
```

El servidor estará disponible en `http://localhost:8000`

## Docker

### Construir y ejecutar
```bash
docker-compose up -d
```

Esto levanta:
- API en `http://localhost:8000`
- Nginx en `http://localhost:80`
- PostgreSQL en puerto 5432

## Estructura del Proyecto

```
sotang-api/
├── alembic/                    # Migraciones de BD
│   ├── versions/              # Scripts de migración
│   └── env.py
├── app/
│   ├── main.py               # Punto de entrada FastAPI
│   ├── worker.py             # Worker para tareas async
│   ├── core/                 # Configuración
│   │   ├── config.py        # Variables de entorno
│   │   ├── database.py      # Conexión a BD
│   │   ├── security.py      # JWT y seguridad
│   │   └── dependencies.py  # Dependencias compartidas
│   ├── models/              # ORM Models (SQLAlchemy)
│   │   ├── usuario.py
│   │   ├── cuenta.py
│   │   ├── transaccion.py
│   │   ├── presupuesto.py
│   │   └── ...
│   ├── schemas/             # Pydantic schemas (validación)
│   ├── routers/             # Endpoints API
│   └── services/            # Lógica de negocio
├── nginx/                    # Configuración Nginx
├── scripts/                  # Scripts útiles
├── docker-compose.yml
├── Dockerfile
└── requirements.txt
```

## Variables de Entorno

Crear archivo `.env` con:
```
DATABASE_URL=postgresql://user:password@localhost:5432/sotang
SECRET_KEY=tu-clave-secreta-muy-larga
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

## API Endpoints

### Autenticación
- `POST /api/v1/auth/register` - Registrar usuario
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/me` - Obtener usuario actual

### Cuentas
- `GET /api/v1/cuentas` - Listar cuentas
- `POST /api/v1/cuentas` - Crear cuenta
- `GET /api/v1/cuentas/{id}` - Detalle cuenta

### Transacciones
- `GET /api/v1/transacciones` - Listar transacciones
- `POST /api/v1/transacciones` - Crear transacción
- `GET /api/v1/dashboard` - Dashboard financiero

## Migraciones de BD

### Crear nueva migración
```bash
alembic revision --autogenerate -m "Descripción del cambio"
```

### Aplicar migraciones
```bash
alembic upgrade head
```

### Revertir all
```bash
alembic downgrade base
```

## Desarrollo

### Tests
```bash
pytest
```

### Linting
```bash
flake8 app/
black app/
```

## Licencia

MIT

## Soporte

Para reportar bugs o sugerencias, abre un issue en el repositorio.

