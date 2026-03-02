.PHONY: up down dev logs test lint clean setup help db-migrate db-reset status prod-up prod-down prod-logs prod-status

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

setup: ## First-time setup: copy env template and pull Docker images
	@test -f .env || (cp .env.example .env && echo "Created .env from .env.example — edit it with your API keys")
	@test -f .env && echo ".env exists"
	docker compose pull db

up: ## Build and start all services (PostgreSQL + API + Web)
	docker compose up -d --build
	@echo ""
	@echo "\033[32mHojaa is starting...\033[0m"
	@echo ""
	@echo "  Web UI:   http://localhost:$${WEB_PORT:-3000}"
	@echo "  API:      http://localhost:$${API_PORT:-8000}"
	@echo "  API Docs: http://localhost:$${API_PORT:-8000}/api/docs"
	@echo ""
	@echo "Run 'make logs' to watch output."

down: ## Stop all services
	docker compose down

dev: ## Start services with logs attached (foreground)
	docker compose up --build

logs: ## Tail logs from all services
	docker compose logs -f

test: ## Run backend test suite
	cd backend && python -m pytest tests/ -v

lint: ## Run linters (backend + frontend)
	cd backend && python -m flake8 app/ --max-line-length=120 --exclude=__pycache__ 2>/dev/null || true
	cd web && npm run lint 2>/dev/null || true

clean: ## Stop services and remove volumes (WARNING: deletes database)
	docker compose down -v --remove-orphans

db-migrate: ## Run database migrations
	docker compose exec api alembic upgrade head

db-reset: ## Reset database (WARNING: destroys all data)
	docker compose down -v
	docker compose up -d db
	@echo "Waiting for database..."
	@sleep 5
	docker compose up -d api

status: ## Show service status
	docker compose ps

# ── Production (docker-compose.prod.yml) ──

prod-up: ## Build and start production services (with Caddy SSL)
	docker compose -f docker-compose.prod.yml up -d --build
	@echo ""
	@echo "\033[32mHojaa production is starting...\033[0m"
	@echo ""
	@echo "  Site:     https://hojaa.com"
	@echo "  API:      https://hojaa.com/api/docs"
	@echo ""

prod-down: ## Stop production services
	docker compose -f docker-compose.prod.yml down

prod-logs: ## Tail production logs
	docker compose -f docker-compose.prod.yml logs -f

prod-status: ## Show production service status
	docker compose -f docker-compose.prod.yml ps
