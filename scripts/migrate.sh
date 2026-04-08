#!/bin/bash
# Aplica migraciones de Alembic dentro del contenedor api

set -e

cd "$(dirname "$0")/.."

echo "[Sotang] Aplicando migraciones..."
docker compose exec api alembic upgrade head
echo "[Sotang] Migraciones aplicadas correctamente."

# Mostrar estado actual
docker compose exec api alembic current
