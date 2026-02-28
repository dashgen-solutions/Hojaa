<div align="center">
  <img src="assets/logo.svg" alt="Hojaa" width="180" />

  <h1>Hojaa</h1>

  <p><strong>AI-powered requirements discovery & scope management for teams that move fast</strong></p>

  <p>Turn vague ideas into structured requirement trees through intelligent progressive questioning.<br/>Track scope changes, audit decisions, and plan execution — all in one place.</p>

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
    <a href="#-architecture">Architecture</a> &bull;
    <a href="docs/">Documentation</a>
  </p>
</div>

---

<!-- Replace with your own demo GIF or screenshot -->
<div align="center">
  <img src="assets/demo-placeholder.png" alt="Hojaa Demo" width="800" />
  <br/><em>Upload a document &rarr; Answer AI-generated questions &rarr; Explore your requirement tree</em>
</div>

---

## Quick Start

```bash
git clone https://github.com/YOUR_ORG/hojaa.git && cd hojaa
cp .env.example .env          # Add your OpenAI or Anthropic API key
make up                        # Starts PostgreSQL + API + Web UI
```

Open **http://localhost:3000** — that's it.

> **Need help?** Run `make help` for all available commands, or see the [full setup guide](#-development).

---

## Why Hojaa?

AI project cycles are chaotic. A meeting changes priorities. An email redefines scope. Traditional PM tools track *tasks* — Hojaa tracks **decisions and their context**.

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
| Export to PDF / JSON / Markdown | — | — | — | — | **Yes** |
| Multi-LLM (OpenAI, Anthropic, Azure, Ollama) | — | — | — | — | **Yes** |
| Self-hosted / on-premise ready | No | No | No | No | **Yes** |

---

## Features

<details>
<summary><strong>Document Upload & AI Analysis</strong></summary>

Upload PDF, DOCX, or TXT documents. Hojaa extracts context and generates **10 targeted questions** tailored to your project type — technical and non-technical variants included.

</details>

<details>
<summary><strong>Interactive Requirement Tree</strong></summary>

Requirements are organized in a hierarchical tree powered by React Flow. Click **[+]** on any node to start a contextual AI conversation that explores that specific feature in depth. Confirmed insights are added as child nodes — the tree grows as understanding deepens.

</details>

<details>
<summary><strong>Multi-Source Ingestion</strong></summary>

Feed meeting notes, Slack threads, emails, or additional documents into your session. Hojaa's AI detects scope changes, suggests tree modifications, and attributes every change to its source. Nothing is lost.

</details>

<details>
<summary><strong>Audit Trail & Time Travel</strong></summary>

Every change is recorded with full attribution — who changed what, when, and why. Browse the complete history timeline or use **time-travel view** to see your requirement tree at any historical point.

</details>

<details>
<summary><strong>Planning Board</strong></summary>

Kanban-style board (Backlog &rarr; TODO &rarr; In Progress &rarr; Review &rarr; Done) that maps requirements directly to work items. AI-generated acceptance criteria for each card. Assign team members and track progress.

</details>

<details>
<summary><strong>Export & Integrations</strong></summary>

Export your requirement tree and planning board to **PDF**, **JSON**, or **Markdown**. Push cards to **Jira** or send notifications to **Slack**. White-label the interface with your own branding.

</details>

<details>
<summary><strong>Real-Time Collaboration</strong></summary>

WebSocket-powered presence indicators show who's viewing or editing. Multiple team members can work on the same session simultaneously with live updates.

</details>

<details>
<summary><strong>Multi-LLM Provider Support</strong></summary>

Switch between **OpenAI**, **Anthropic Claude**, **Azure OpenAI**, or **Ollama** (local/offline) with a single environment variable. Per-task model routing and cost-tier optimization built in.

</details>

---

## Architecture

```mermaid
graph TB
    subgraph Client
        Browser["Browser<br/><small>Next.js 14 + Tailwind</small>"]
    end

    subgraph "Docker Compose"
        API["FastAPI API<br/><small>:8000</small>"]
        DB[("PostgreSQL<br/><small>:5432</small>")]
        WS["WebSocket Hub"]
    end

    subgraph "AI Providers"
        OpenAI["OpenAI<br/><small>GPT-4o</small>"]
        Anthropic["Anthropic<br/><small>Claude 3.5</small>"]
        Azure["Azure OpenAI"]
        Ollama["Ollama<br/><small>Local LLM</small>"]
    end

    subgraph Integrations
        Jira["Jira Cloud"]
        Slack["Slack"]
    end

    Browser -->|"REST + WebSocket"| API
    API --> DB
    API --> WS
    API -->|"Per-task routing"| OpenAI
    API -->|"Per-task routing"| Anthropic
    API -->|"Per-task routing"| Azure
    API -->|"Per-task routing"| Ollama
    API --> Jira
    API --> Slack
```

### How It Works

```
1. UPLOAD      User uploads a document or describes their project
                    |
2. QUESTIONS   AI generates 10 targeted questions based on context
                    |
3. TREE        AI builds a hierarchical requirement tree from answers
                    |
4. EXPLORE     Click [+] on any node → contextual AI chat → tree expands
                    |
5. INGEST      Feed meeting notes, emails → scope changes detected
                    |
6. PLAN        Map requirements to work items on the planning board
                    |
7. EXPORT      Generate PDF/JSON reports, push to Jira, notify Slack
```

---

## LLM Providers

Hojaa supports multiple AI providers with **per-task model routing** and **cost-tier optimization**.

| Provider | Config | Best For |
|:---|:---|:---|
| **OpenAI** | `OPENAI_API_KEY` | Default. GPT-4o for complex tasks, GPT-4o-mini for lightweight |
| **Anthropic** | `ANTHROPIC_API_KEY` | Claude 3.5 Sonnet for nuanced analysis |
| **Azure OpenAI** | `AZURE_OPENAI_*` | Enterprise deployments with data residency requirements |
| **Ollama** | `OLLAMA_BASE_URL` | Fully local/offline — no data leaves your machine |

Set `LLM_PROVIDER` in `.env` to your preferred default. Individual tasks can be routed to specific models via `TASK_MODEL_*` variables. See [.env.example](.env.example) for full configuration.

---

## Configuration

<details>
<summary><strong>Environment Variables Reference</strong></summary>

| Variable | Default | Description |
|:---|:---|:---|
| `LLM_PROVIDER` | `openai` | Default provider: `openai`, `anthropic`, `azure`, `ollama` |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `ANTHROPIC_API_KEY` | — | Anthropic API key |
| `AZURE_OPENAI_API_KEY` | — | Azure OpenAI API key |
| `AZURE_OPENAI_ENDPOINT` | — | Azure resource endpoint URL |
| `AZURE_OPENAI_DEPLOYMENT` | — | Azure deployment name |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `llama3` | Ollama model name |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/hojaa_db` | PostgreSQL connection |
| `SECRET_KEY` | — | JWT signing key (change in production) |
| `CORS_ORIGINS` | `["http://localhost:3000"]` | Allowed frontend origins |
| `SMTP_ENABLED` | `false` | Enable email notifications |

See [.env.example](.env.example) for the complete list.

</details>

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

### Local Development (Without Docker)

<details>
<summary><strong>Backend</strong></summary>

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env        # Edit with your config
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

Or manually:

```bash
cd backend
python -m pytest tests/ -v
```

---

## Project Structure

```
hojaa/
├── backend/                   Python FastAPI API
│   ├── app/
│   │   ├── api/routes/        21 API endpoint modules
│   │   ├── services/          30 service modules (business logic)
│   │   ├── models/            SQLAlchemy ORM + Pydantic schemas
│   │   ├── core/              Config, auth, logging, permissions
│   │   ├── middleware/        Security, rate limiting, metrics
│   │   └── db/                Database session management
│   ├── alembic/               Database migrations
│   ├── tests/                 Test suite
│   └── Dockerfile
├── web/                       Next.js 14 frontend
│   ├── src/
│   │   ├── app/               Pages (sessions, audit, planning, metrics)
│   │   ├── components/        React components by feature
│   │   ├── stores/            Zustand state management
│   │   ├── hooks/             Custom hooks (WebSocket, audio, etc.)
│   │   └── contexts/          Auth context
│   └── Dockerfile
├── docs/                      Documentation
│   ├── product/               Product specs & competitive analysis
│   └── WAY_FORWARD.md         Strategic roadmap
├── assets/                    Logos, screenshots, diagrams
├── scripts/                   Setup & utility scripts
├── docker-compose.yml         One-command deployment
├── Makefile                   Developer commands
└── .env.example               Configuration template
```

---

## Deployment

Hojaa is designed to run on affordable infrastructure. A **$10-20/month VM** (1 vCPU, 2GB RAM) handles small teams comfortably.

```bash
# On your VM:
git clone https://github.com/YOUR_ORG/hojaa.git && cd hojaa
cp .env.example .env           # Configure production values
docker compose up -d           # Detached mode
```

For production, remember to:
- Set a strong `SECRET_KEY`
- Set `ENVIRONMENT=production`
- Configure `CORS_ORIGINS` for your domain
- Use a managed PostgreSQL if available

---

## API Documentation

Once the backend is running:
- **Swagger UI**: http://localhost:8000/api/docs
- **ReDoc**: http://localhost:8000/api/redoc
- **OpenAPI Spec**: http://localhost:8000/api/openapi.json

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## Security

See [SECURITY.md](SECURITY.md) for our security policy and responsible disclosure process.

---

## License

[MIT](LICENSE) &copy; 2026 DashGen Solutions

---

<div align="center">
  <sub>Built with FastAPI, Next.js, and a lot of AI &mdash; by the Hojaa team at DashGen Solutions</sub>
</div>
