<div align="center">
  <img src="assets/logo-dark.svg" alt="Hojaa" width="280" />

  <br/><br/>

  <p><strong>Make it happen.</strong></p>

  <p>AI-powered requirements discovery & scope management.<br/>Turn vague ideas into structured requirement trees through intelligent progressive questioning.</p>

  <p>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License" /></a>
    <img src="https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white" alt="Python 3.11+" />
    <img src="https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs&logoColor=white" alt="Next.js 14" />
    <img src="https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white" alt="FastAPI" />
    <img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white" alt="Docker" />
    <img src="https://img.shields.io/badge/PostgreSQL-14-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  </p>

  <p>
    <a href="#-quick-start">Quick Start</a> &bull;
    <a href="#-why-hojaa">Why Hojaa</a> &bull;
    <a href="#-features">Features</a> &bull;
    <a href="#-llm-providers">LLM Providers</a> &bull;
    <a href="docs/">Docs</a>
  </p>
</div>

---

## Quick Start

```bash
git clone https://github.com/YOUR_ORG/hojaa.git && cd hojaa
cp .env.example .env          # Add your OpenAI or Anthropic API key
make up                        # Starts PostgreSQL + API + Web UI
```

Open **http://localhost:3000** and you're ready to go.

> Run `make help` for all available commands, or see the [full setup guide](#-development).

---

## Why Hojaa?

AI project cycles are chaotic. Meetings change priorities. Emails redefine scope. Traditional PM tools track *tasks* — Hojaa tracks **decisions and their context**.

| Capability | Jira | ClickUp | Notion | Linear | **Hojaa** |
|:---|:---:|:---:|:---:|:---:|:---:|
| AI requirement extraction from documents | — | — | — | — | **Yes** |
| Progressive questioning (10 targeted Qs) | — | — | — | — | **Yes** |
| Interactive requirement tree visualization | — | — | — | — | **Yes** |
| Per-feature contextual chat exploration | — | — | — | — | **Yes** |
| Multi-source ingestion (meetings, PDFs, Slack) | — | — | — | — | **Yes** |
| Scope change detection & audit trail | Partial | — | — | — | **Yes** |
| Time-travel (view scope at any point in time) | — | — | — | — | **Yes** |
| Planning board with AI acceptance criteria | Basic | Yes | — | Yes | **Yes** |
| Document builder (proposals, SOWs, contracts) | — | — | — | — | **Yes** |
| Multi-LLM (OpenAI, Anthropic, Azure, Ollama) | — | — | — | — | **Yes** |
| Self-hosted / on-premise ready | No | No | No | No | **Yes** |

---

## Features

### Document Upload & AI Analysis

Upload PDF, DOCX, or TXT documents. Hojaa extracts context and generates **10 targeted questions** tailored to your project type — technical and non-technical variants included.

### Interactive Requirement Tree

Requirements are organized in a hierarchical tree powered by React Flow. Click **[+]** on any node to start a contextual AI conversation that explores that specific feature in depth. Confirmed insights are added as child nodes — the tree grows as understanding deepens.

### Multi-Source Ingestion

Feed meeting notes, Slack threads, emails, or additional documents into your session. Hojaa detects scope changes, suggests tree modifications, and attributes every change to its source.

### Audit Trail & Time Travel

Every change is recorded with full attribution — who changed what, when, and why. Browse the complete history timeline or use **time-travel view** to see your requirement tree at any historical point.

### Document Builder

Create proposals, SOWs, and contracts with an AI-powered block editor. Insert project variables, add pricing tables, and generate content with the built-in AI assistant. Share documents with clients via secure links.

### Planning Board

Kanban-style board (Backlog → TODO → In Progress → Review → Done) that maps requirements directly to work items. AI-generated acceptance criteria for each card. Assign team members and track progress.

### Team Messaging

Built-in real-time messaging with DMs and group channels. Reference projects and tasks directly in conversations. WebSocket-powered with auto-reconnect.

### Export & Integrations

Export your requirement tree and planning board to **PDF**, **JSON**, or **Markdown**. Push cards to **Jira** or send notifications to **Slack**. White-label the interface with your own branding.

---

## How It Works

```
1. UPLOAD      Upload a document or describe your project
2. QUESTIONS   AI generates 10 targeted questions based on context
3. TREE        AI builds a hierarchical requirement tree from answers
4. EXPLORE     Click [+] on any node → contextual AI chat → tree expands
5. INGEST      Feed meeting notes, emails → scope changes detected
6. PLAN        Map requirements to work items on the planning board
7. EXPORT      Generate documents, push to Jira, notify Slack
```

---

## LLM Providers

Hojaa supports multiple AI providers with per-task model routing and cost-tier optimization.

| Provider | Config | Best For |
|:---|:---|:---|
| **OpenAI** | `OPENAI_API_KEY` | Default. GPT-4o for complex tasks, GPT-4o-mini for lightweight |
| **Anthropic** | `ANTHROPIC_API_KEY` | Claude for nuanced analysis |
| **Azure OpenAI** | `AZURE_OPENAI_*` | Enterprise deployments with data residency requirements |
| **Ollama** | `OLLAMA_BASE_URL` | Fully local/offline — no data leaves your machine |

Set `LLM_PROVIDER` in `.env` to your preferred default. See [.env.example](.env.example) for full configuration.

---

## Development

### Prerequisites

- **Docker & Docker Compose** (recommended) — OR:
- Python 3.11+, Node.js 18+, PostgreSQL 14+

### Docker (Recommended)

```bash
cp .env.example .env          # Configure your API keys
make up                        # Build and start all services
make logs                      # Tail logs from all services
make down                      # Stop everything
```

### Local Development

<details>
<summary><strong>Backend</strong></summary>

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs at http://localhost:8000/api/docs

</details>

<details>
<summary><strong>Frontend</strong></summary>

```bash
cd web
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

Web UI at http://localhost:3000

</details>

---

## Testing

```bash
make test                      # Run backend test suite
```

---

## Project Structure

```
hojaa/
├── backend/                   Python FastAPI API
│   ├── app/
│   │   ├── api/routes/        API endpoint modules
│   │   ├── services/          Business logic
│   │   ├── models/            SQLAlchemy ORM + Pydantic schemas
│   │   ├── core/              Config, auth, logging, permissions
│   │   └── middleware/        Security, rate limiting, metrics
│   ├── alembic/               Database migrations
│   └── Dockerfile
├── web/                       Next.js 14 frontend
│   ├── src/
│   │   ├── app/               Pages & route groups
│   │   ├── components/        React components by feature
│   │   ├── stores/            Zustand state management
│   │   ├── hooks/             Custom hooks
│   │   └── contexts/          Auth & theme contexts
│   └── Dockerfile
├── docs/                      Documentation
├── assets/                    Brand assets
├── docker-compose.yml         One-command deployment
├── Makefile                   Developer commands
└── .env.example               Configuration template
```

---

## Deployment

Hojaa runs on affordable infrastructure. A **$10-20/month VM** (1 vCPU, 2GB RAM) handles small teams comfortably.

```bash
git clone https://github.com/YOUR_ORG/hojaa.git && cd hojaa
cp .env.example .env           # Configure production values
docker compose up -d
```

For production:
- Set a strong `SECRET_KEY` and `ENVIRONMENT=production`
- Configure `CORS_ORIGINS` for your domain
- Use a managed PostgreSQL if available

---

## API Documentation

- **Swagger UI**: http://localhost:8000/api/docs
- **ReDoc**: http://localhost:8000/api/redoc
- **OpenAPI Spec**: http://localhost:8000/api/openapi.json

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

See [SECURITY.md](SECURITY.md) for our security policy and responsible disclosure process.

## License

[MIT](LICENSE) &copy; 2026 DashGen Solutions

---

<div align="center">
  <sub>Built with FastAPI, Next.js, and a lot of AI — by the Hojaa team at DashGen Solutions</sub>
</div>
