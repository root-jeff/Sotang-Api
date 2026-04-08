#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# setup-raspi.sh — Configuración inicial de la Raspberry Pi 5 para Sotang
# Ubuntu Server 24.04 LTS
#
# Uso: bash setup-raspi.sh
# ══════════════════════════════════════════════════════════════════════════════

set -e  # salir si cualquier comando falla

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ── 1. Update del sistema ──────────────────────────────────────────────────────
log "Actualizando sistema..."
sudo apt-get update -y && sudo apt-get upgrade -y
sudo apt-get install -y curl git nano htop ufw

# ── 2. Docker ─────────────────────────────────────────────────────────────────
if ! command -v docker &> /dev/null; then
    log "Instalando Docker..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
    log "Docker instalado. NOTA: necesitas cerrar sesión y volver a entrar para usar docker sin sudo."
else
    log "Docker ya instalado: $(docker --version)"
fi

# Docker Compose plugin
if ! docker compose version &> /dev/null; then
    log "Instalando Docker Compose plugin..."
    sudo apt-get install -y docker-compose-plugin
else
    log "Docker Compose ya instalado: $(docker compose version)"
fi

# ── 3. Tailscale ──────────────────────────────────────────────────────────────
if ! command -v tailscale &> /dev/null; then
    log "Instalando Tailscale..."
    curl -fsSL https://tailscale.com/install.sh | sh
    log "Tailscale instalado. Ejecuta 'sudo tailscale up' para autenticar."
else
    log "Tailscale ya instalado: $(tailscale version)"
fi

# ── 4. Firewall (UFW) ─────────────────────────────────────────────────────────
log "Configurando firewall..."
sudo ufw --force enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh          # SSH siempre disponible
sudo ufw allow 80/tcp       # Nginx (solo acceso desde Tailscale en producción)
# No exponemos 8000 ni 5432 directamente — solo Nginx en puerto 80
log "Firewall configurado. Acceso externo: solo SSH y 80."

# ── 5. Directorios del proyecto ────────────────────────────────────────────────
log "Creando estructura de directorios..."
mkdir -p ~/sotang/sotang-api/storage
mkdir -p ~/sotang/sotang-api/secrets
mkdir -p ~/sotang/sotang-api/nginx

# ── 6. Clonar repos (si no existen) ───────────────────────────────────────────
if [ ! -d ~/sotang/sotang-api/.git ]; then
    warn "Clona el repo manualmente:"
    warn "  cd ~/sotang && git clone https://github.com/TU_USUARIO/sotang-api.git"
else
    log "Repo sotang-api ya clonado."
fi

# ── 7. Configurar .env ────────────────────────────────────────────────────────
if [ ! -f ~/sotang/sotang-api/.env ]; then
    warn "No existe .env — copia .env.example y complétalo:"
    warn "  cp ~/sotang/sotang-api/.env.example ~/sotang/sotang-api/.env"
    warn "  nano ~/sotang/sotang-api/.env"
else
    log ".env ya configurado."
fi

# ── 8. Autostart con systemd ──────────────────────────────────────────────────
log "Creando servicio systemd para autostart..."
sudo tee /etc/systemd/system/sotang.service > /dev/null <<EOF
[Unit]
Description=Sotang — Personal Finance App
After=network.target docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/$USER/sotang/sotang-api
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
User=$USER

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable sotang.service
log "Servicio sotang.service creado y habilitado para autostart."

# ── 9. Instrucciones finales ───────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════"
echo -e "${GREEN}Setup completado.${NC} Próximos pasos:"
echo ""
echo "  1. Autenticar Tailscale:"
echo "     sudo tailscale up"
echo ""
echo "  2. Configurar .env:"
echo "     cp ~/sotang/sotang-api/.env.example ~/sotang/sotang-api/.env"
echo "     nano ~/sotang/sotang-api/.env"
echo ""
echo "  3. Agregar secrets (Google Drive, Firebase):"
echo "     cp gdrive-service-account.json ~/sotang/sotang-api/secrets/"
echo ""
echo "  4. Levantar los servicios:"
echo "     cd ~/sotang/sotang-api"
echo "     docker compose up -d"
echo ""
echo "  5. Correr migraciones:"
echo "     docker compose exec api alembic upgrade head"
echo ""
echo "  6. Verificar que todo corre:"
echo "     docker compose ps"
echo "     curl http://localhost/health"
echo ""
echo "  7. Acceso desde tu PC (con Tailscale activo):"
echo "     http://raspberrypi.TU-TAILNET.ts.net"
echo "══════════════════════════════════════════════════════════════"
