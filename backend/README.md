# MoMetric Requirements Discovery - Backend API

AI-powered requirements discovery system built with **FastAPI**, **LangGraph**, and **PostgreSQL**.

## 🚀 Features

- **Document Analysis**: Upload PDFs, Word docs, or text to extract requirements
- **AI-Powered Questioning**: Generate 10 targeted questions using GPT-4/Claude
- **Tree Building**: Automatically organize requirements into hierarchical structure
- **Feature Exploration**: Detailed conversations for each feature using LangGraph
- **Progressive Questioning**: Adaptive questioning based on user responses
- **RESTful API**: Clean, well-documented endpoints

## 📁 Project Structure

```
backend/
├── app/
│   ├── main.py                 # FastAPI application
│   ├── core/
│   │   ├── config.py           # Settings management
│   │   └── logger.py           # Structured logging
│   ├── api/
│   │   ├── dependencies.py     # Shared dependencies
│   │   └── routes/             # API endpoints
│   │       ├── upload.py       # Document upload
│   │       ├── questions.py    # Question management
│   │       ├── chat.py         # Feature chat
│   │       ├── tree.py         # Tree operations
│   │       └── sessions.py     # Session management
│   ├── models/
│   │   ├── database.py         # SQLAlchemy models
│   │   └── schemas.py          # Pydantic models
│   ├── services/
│   │   ├── llm_service.py          # LLM wrapper
│   │   ├── document_analyzer.py    # Document parsing
│   │   ├── question_generator.py   # Question generation
│   │   ├── tree_builder.py         # Tree construction
│   │   └── conversation_flow.py    # LangGraph conversation
│   ├── db/
│   │   └── session.py          # Database connection
│   └── utils/
│       └── prompts.py          # LLM prompts
├── tests/                      # Test files
├── requirements.txt
├── .env.example
└── README.md
```

## 🛠️ Installation

### Prerequisites

- Python 3.11+
- PostgreSQL 14+
- OpenAI API key or Anthropic API key

### Setup Steps

1. **Clone and navigate**:
```bash
cd backend
```

2. **Create virtual environment**:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies**:
```bash
pip install -r requirements.txt
```

4. **Set up environment variables**:
```bash
cp .env.example .env
# Edit .env with your settings
```

5. **Configure PostgreSQL**:
```bash
# Create database
createdb mometric_db

# Or using psql:
psql -U postgres
CREATE DATABASE mometric_db;
\q
```

6. **Update .env** with your database URL:
```
DATABASE_URL=postgresql://username:password@localhost:5432/mometric_db
OPENAI_API_KEY=your_actual_key_here
```

## 🚀 Running the Server

### Development Mode

```bash
python -m app.main
```

Or with uvicorn:
```bash
uvicorn app.main:app --reload --port 8000
```

Server will start at: **http://localhost:8000**

### Production Mode

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## 📚 API Documentation

Once running, visit:
- **Swagger UI**: http://localhost:8000/api/docs
- **ReDoc**: http://localhost:8000/api/redoc
- **OpenAPI JSON**: http://localhost:8000/api/openapi.json

## 🔌 API Endpoints

### Document Upload
```
POST /api/upload
```
Upload document or text to start session.

**Request**:
```json
{
  "file": "document.pdf"  // or
  "text": "I want to build a chatbot..."
}
```

**Response**:
```json
{
  "session_id": "uuid",
  "questions": [
    {
      "id": "uuid",
      "question_text": "What is the primary goal?",
      "category": "purpose",
      "order_index": 0
    },
    ...
  ]
}
```

### Submit Questions
```
POST /api/questions/submit
```
Submit answers to generate tree.

**Request**:
```json
{
  "session_id": "uuid",
  "answers": [
    {
      "question_id": "uuid",
      "answer_text": "Customer support automation"
    },
    ...
  ]
}
```

**Response**:
```json
{
  "session_id": "uuid",
  "tree": {
    "id": "uuid",
    "question": "Main Project",
    "children": [...]
  }
}
```

### Start Feature Chat
```
POST /api/chat/start
```
Start detailed conversation for a feature.

**Request**:
```json
{
  "session_id": "uuid",
  "node_id": "uuid"
}
```

**Response**:
```json
{
  "conversation_id": "uuid",
  "first_question": "What core capabilities?",
  "suggestions": ["Option 1", "Option 2"]
}
```

### Send Chat Message
```
POST /api/chat/message
```
Continue conversation.

**Request**:
```json
{
  "conversation_id": "uuid",
  "message": "I need FAQ handling and escalation"
}
```

**Response**:
```json
{
  "message": "How should FAQs be handled?",
  "suggestions": ["Knowledge base", "Manual answers"],
  "is_complete": false,
  "extracted_info": {...}
}
```

### Confirm and Add Nodes
```
POST /api/chat/confirm
```
Confirm conversation and add child nodes.

**Request**:
```json
{
  "conversation_id": "uuid"
}
```

**Response**:
```json
{
  "parent_node_id": "uuid",
  "new_children": [
    {
      "id": "uuid",
      "question": "FAQ Handling",
      "answer": "...",
      "type": "detail"
    },
    ...
  ]
}
```

### Get Tree
```
GET /api/tree/{session_id}
```
Get complete requirements tree.

### Get Sessions
```
GET /api/sessions?limit=10
```
List recent sessions.

## 🔧 Configuration

### Environment Variables

Create `.env` file with:

```bash
# Application
APP_NAME="MoMetric Requirements Discovery API"
ENVIRONMENT=development
DEBUG=True

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mometric_db

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview

# Anthropic (alternative)
ANTHROPIC_API_KEY=sk-ant-...
LLM_PROVIDER=openai  # or anthropic

# CORS
CORS_ORIGINS=http://localhost:3000

# File Upload
MAX_FILE_SIZE_MB=10
```

## 🗄️ Database Schema

### Tables

1. **sessions** - User sessions
2. **questions** - Initial 10 questions
3. **nodes** - Tree structure
4. **conversations** - Feature chats
5. **messages** - Chat messages

### Migrations

Using Alembic (optional):
```bash
alembic init migrations
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head
```

## 🧪 Testing

```bash
pytest tests/
```

## 🐳 Docker Deployment

Coming soon...

## 📊 Monitoring

Logs are output in JSON format for easy parsing:

```json
{
  "timestamp": "2026-01-13T03:30:00Z",
  "level": "info",
  "message": "Session created",
  "session_id": "uuid"
}
```

## 🔒 Security

- Input validation with Pydantic
- File upload size/type restrictions
- SQL injection prevention via SQLAlchemy ORM
- CORS configuration
- Environment variable management

## 🚀 Performance Tips

1. **Use connection pooling** (configured by default)
2. **Enable caching** with Redis for LLM responses
3. **Optimize database queries** with proper indexes
4. **Use async/await** for I/O operations

## 🤝 Integration with Frontend

Update frontend API URL:
```typescript
// requirements-discovery-ui/src/app/api/chat/route.ts
const response = await fetch('http://localhost:8000/api/chat/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ... })
});
```

## 📝 Development Workflow

1. Make changes to code
2. Server auto-reloads (if using `--reload`)
3. Test via Swagger UI at `/api/docs`
4. Check logs for errors
5. Test integration with frontend

## 🐛 Troubleshooting

### Database Connection Error
```bash
# Check PostgreSQL is running
sudo service postgresql status

# Check connection string in .env
DATABASE_URL=postgresql://user:password@localhost:5432/mometric_db
```

### LLM API Error
```bash
# Verify API key in .env
OPENAI_API_KEY=sk-...

# Check API key is valid:
curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Import Errors
```bash
# Ensure virtual environment is activated
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Reinstall dependencies
pip install -r requirements.txt
```

## 📚 Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [LangGraph Guide](https://langchain-ai.github.io/langgraph/)
- [SQLAlchemy Docs](https://docs.sqlalchemy.org/)
- [Pydantic Documentation](https://docs.pydantic.dev/)

## 📄 License

MIT

## 👥 Contributors

MoMetric Team

---

**Need help?** Check the logs or create an issue.
