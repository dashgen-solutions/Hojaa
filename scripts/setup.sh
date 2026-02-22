#!/usr/bin/env bash
set -euo pipefail

echo "=== MoMetric Setup ==="
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed."
    echo "Install Docker Desktop: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "ERROR: Docker Compose V2 is not available."
    echo "Update Docker Desktop or install the compose plugin."
    exit 1
fi

echo "Docker:  $(docker --version | head -1)"
echo "Compose: $(docker compose version | head -1)"
echo ""

# Create .env if not exists
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env from .env.example"
    echo ""
    echo "IMPORTANT: Edit .env and add at least one LLM API key:"
    echo "  - OPENAI_API_KEY     for OpenAI (recommended)"
    echo "  - ANTHROPIC_API_KEY  for Anthropic Claude"
    echo "  - AZURE_OPENAI_*     for Azure OpenAI"
    echo "  - OLLAMA_BASE_URL    for local Ollama"
    echo ""
    read -p "Press Enter after editing .env, or Ctrl+C to exit... "
else
    echo "Found existing .env file"
fi

echo ""
echo "Building and starting services..."
docker compose up -d --build

echo ""
echo "Waiting for services to start..."
sleep 15

# Check health
API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-3000}"

if curl -sf "http://localhost:${API_PORT}/health" > /dev/null 2>&1; then
    echo "API is healthy!"
else
    echo "API is still starting (first build takes ~60s)..."
    echo "Run 'make logs' to monitor progress."
fi

echo ""
echo "=== MoMetric is ready ==="
echo ""
echo "  Web UI:     http://localhost:${WEB_PORT}"
echo "  API:        http://localhost:${API_PORT}"
echo "  API Docs:   http://localhost:${API_PORT}/api/docs"
echo ""
echo "  Stop:       make down"
echo "  Logs:       make logs"
echo "  Help:       make help"
