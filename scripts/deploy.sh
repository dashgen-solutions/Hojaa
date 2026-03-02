#!/usr/bin/env bash
# ============================================================
# Hojaa Production Deployment Script
# Run this on a fresh Ubuntu 22.04 VM to set up everything.
# ============================================================
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/dashgen-ai-analytics/mometric.git}"
BRANCH="${BRANCH:-restructure/v1.0-github-showcase}"
APP_DIR="/opt/hojaa"

echo "================================================"
echo "  Hojaa Production Setup"
echo "================================================"

# --- 1. System updates ---
echo "[1/6] Updating system packages..."
sudo apt-get update -qq
sudo apt-get upgrade -y -qq

# --- 2. Install Docker ---
echo "[2/6] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker "$USER"
    echo "Docker installed. You may need to log out and back in for group changes."
else
    echo "Docker already installed."
fi

# --- 3. Install Docker Compose plugin ---
echo "[3/6] Verifying Docker Compose..."
if ! docker compose version &> /dev/null; then
    sudo apt-get install -y docker-compose-plugin
fi
docker compose version

# --- 4. Clone or update repo ---
echo "[4/6] Setting up application..."
if [ -d "$APP_DIR" ]; then
    echo "Updating existing installation..."
    cd "$APP_DIR"
    sudo git fetch origin
    sudo git checkout "$BRANCH"
    sudo git pull origin "$BRANCH"
else
    echo "Cloning repository..."
    sudo git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# --- 5. Environment file ---
echo "[5/6] Checking environment file..."
if [ ! -f "$APP_DIR/.env" ]; then
    sudo cp "$APP_DIR/.env.example" "$APP_DIR/.env"
    echo ""
    echo "WARNING: .env created from template."
    echo "You MUST edit /opt/hojaa/.env with your production values:"
    echo "  - SECRET_KEY (random 64-char string)"
    echo "  - OPENAI_API_KEY"
    echo "  - SMTP_PASSWORD"
    echo "  - POSTGRES_PASSWORD"
    echo ""
    echo "Run: sudo nano /opt/hojaa/.env"
    echo "Then re-run this script or: cd /opt/hojaa && sudo docker compose -f docker-compose.prod.yml up -d --build"
    exit 0
fi

# --- 6. Build and start ---
echo "[6/6] Building and starting services..."
cd "$APP_DIR"
sudo docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "================================================"
echo "  Hojaa is running!"
echo "================================================"
echo ""
echo "  Caddy will auto-obtain SSL once DNS points here."
echo "  Check status:  cd /opt/hojaa && sudo docker compose -f docker-compose.prod.yml ps"
echo "  View logs:     cd /opt/hojaa && sudo docker compose -f docker-compose.prod.yml logs -f"
echo ""
