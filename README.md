# 🎯 MoMetric Requirements Discovery System

**AI-powered progressive requirements discovery with tree-based visualization**

A complete full-stack application that helps gather detailed project requirements from clients through intelligent, progressive questioning.

---

## 📁 Project Structure

```
Mometric_Mouaaz/
│
├── backend/                          🐍 FastAPI Backend
│   ├── app/                         Main application
│   │   ├── api/routes/             API endpoints
│   │   ├── services/               Business logic
│   │   ├── models/                 Data models
│   │   ├── core/                   Configuration
│   │   └── db/                     Database
│   ├── tests/                       Unit tests
│   ├── requirements.txt            Python dependencies
│   ├── Dockerfile                   Docker support
│   ├── docker-compose.yml          Multi-container setup
│   ├── README.md                    Backend docs
│   ├── QUICKSTART.md               Quick setup
│   ├── PROJECT_STRUCTURE.md        Architecture
│   ├── INTEGRATION_GUIDE.md        Frontend integration
│   └── PROJECT_SUMMARY.md          Complete summary
│
├── requirements-discovery-ui/       ⚛️ Next.js Frontend
│   ├── src/
│   │   ├── app/                    Next.js app directory
│   │   └── components/             React components
│   │       ├── upload/             Document upload
│   │       ├── questions/          Initial questions
│   │       ├── tree/               Tree visualization
│   │       ├── chat/               Chat interface
│   │       └── layout/             Layout components
│   ├── public/                      Static assets
│   ├── tailwind.config.ts          Tailwind (Specifai colors)
│   ├── package.json                Node dependencies
│   ├── README.md                    Frontend docs
│   ├── QUICKSTART.md               Quick setup
│   └── VISUAL_GUIDE.md             UI walkthrough
│
├── problem statment/                📋 Product Documentation
│   ├── README (2).md               MoMetric overview
│   ├── MVP-Plan.md                 MVP specification
│   ├── Ideation.md                 Initial brainstorming
│   ├── Product-Structure.md        Product structure
│   ├── Differentiation.md          Competitive analysis
│   ├── Quick-Reference.md          Quick overview
│   └── Scope-Canvas-Module.md      Feature details
│
└── README.md                        📖 This file
```

---

## 🎯 What This System Does

### The Problem
Clients often have vague ideas: *"I want a chatbot"* or *"I need an app"*

### The Solution
**3-Step Progressive Requirements Discovery:**

```
1. 📄 UPLOAD
   └─→ User uploads document or types description
   
2. ❓ QUESTIONS (10 Initial Questions)
   └─→ AI asks 10 targeted, granular questions
   
3. 🌳 TREE & CHAT
   ├─→ AI generates feature tree
   └─→ Click [+] on any feature
       └─→ Contextual chat opens
           └─→ Detailed Q&A
               └─→ Confirm & add nodes
                   └─→ Tree expands
```

### Example Flow

```
Input: "I want a customer support chatbot"

↓ AI generates 10 questions:

Q1: What's the primary goal?
Q2: Who are the target users?
Q3: What features do you want?
...

↓ User answers all questions

↓ AI builds tree:

Project: Customer Support Bot
├── 💬 Chat Interface [+]
├── 📚 Knowledge Base [+]
├── 🔔 Escalation System [+]
└── 📊 Analytics [+]

↓ User clicks [+] on "Chat Interface"

↓ Contextual chat opens:
AI: "What capabilities should the chat have?"
User: "FAQ handling and live chat handoff"
AI: "How should FAQs be organized?"
User: "By category with search"

↓ User clicks "Confirm & Add to Tree"

↓ Tree expands:

Project: Customer Support Bot
├── 💬 Chat Interface
│   ├── FAQ Handling
│   │   ├── Category-based organization
│   │   └── Search functionality
│   └── Live chat handoff
├── 📚 Knowledge Base [+]
...
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ (for frontend)
- **Python** 3.11+ (for backend)
- **PostgreSQL** 14+ (for database)
- **OpenAI API Key** or **Anthropic API Key**

### Option 1: Full Docker Setup (Easiest)

```bash
# 1. Clone repository
cd Mometric_Mouaaz

# 2. Setup Backend
cd backend
echo "OPENAI_API_KEY=sk-your-key-here" > .env
docker-compose up -d

# 3. Setup Frontend
cd ../requirements-discovery-ui
npm install
npm run dev
```

**Done!** 
- Backend: http://localhost:8000
- Frontend: http://localhost:3000

### Option 2: Local Development

#### Backend Setup
```bash
cd backend

# Windows
setup.bat

# Mac/Linux
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python setup.py

# Edit .env with your API key
# DATABASE_URL=postgresql://...
# OPENAI_API_KEY=sk-...

# Run
python run_dev.py
```

#### Frontend Setup
```bash
cd requirements-discovery-ui
npm install
npm run dev
```

---

## 🏗️ Tech Stack

### Frontend
- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling (Specifai color scheme)
- **React** - UI library

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - ORM
- **PostgreSQL** - Database
- **LangChain** - LLM framework
- **LangGraph** - Conversation flows
- **OpenAI/Anthropic** - AI models
- **PyPDF2** - PDF parsing
- **python-docx** - Word parsing

### Infrastructure
- **Docker** - Containerization
- **Uvicorn** - ASGI server
- **Pytest** - Testing

---

## 📚 Documentation

### Backend Documentation
- **[backend/README.md](backend/README.md)** - Complete backend guide (500+ lines)
- **[backend/QUICKSTART.md](backend/QUICKSTART.md)** - 5-minute setup
- **[backend/PROJECT_STRUCTURE.md](backend/PROJECT_STRUCTURE.md)** - Architecture details
- **[backend/INTEGRATION_GUIDE.md](backend/INTEGRATION_GUIDE.md)** - Frontend integration
- **[backend/PROJECT_SUMMARY.md](backend/PROJECT_SUMMARY.md)** - Complete summary

### Frontend Documentation
- **[requirements-discovery-ui/README.md](requirements-discovery-ui/README.md)** - Frontend guide
- **[requirements-discovery-ui/QUICKSTART.md](requirements-discovery-ui/QUICKSTART.md)** - Quick setup
- **[requirements-discovery-ui/VISUAL_GUIDE.md](requirements-discovery-ui/VISUAL_GUIDE.md)** - UI walkthrough

### Product Documentation
- **[problem statment/README (2).md](problem%20statment/README%20(2).md)** - MoMetric overview
- **[problem statment/MVP-Plan.md](problem%20statment/MVP-Plan.md)** - MVP details

---

## 🔗 API Documentation

Once backend is running:
- **Swagger UI**: http://localhost:8000/api/docs
- **ReDoc**: http://localhost:8000/api/redoc

---

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest tests/
pytest --cov=app tests/
```

### Frontend (Manual)
1. Open http://localhost:3000
2. Upload document or enter text
3. Answer 10 questions
4. View tree
5. Click [+] on feature
6. Chat and confirm
7. See tree expand

---

## 🔧 Configuration

### Backend (.env)
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mometric_db
OPENAI_API_KEY=sk-your-actual-key-here
SECRET_KEY=random-secret-string
CORS_ORIGINS=http://localhost:3000
LLM_PROVIDER=openai
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 📊 Features

### ✅ Implemented
- [x] Document upload (PDF, DOCX, TXT)
- [x] Text input
- [x] AI question generation (10 questions)
- [x] Question categorization
- [x] Answer submission
- [x] Tree generation
- [x] Tree visualization
- [x] Feature expansion (+ button)
- [x] Contextual chat
- [x] Progressive questioning
- [x] Node addition
- [x] Session management
- [x] Conversation history
- [x] Responsive UI
- [x] Specifai-inspired design
- [x] Error handling
- [x] Loading states
- [x] Docker support
- [x] API documentation
- [x] Comprehensive docs

### 🔮 Future Enhancements
- [ ] User authentication
- [ ] Multi-user sessions
- [ ] Export to PDF/JSON
- [ ] Collaboration features
- [ ] Version control
- [ ] Templates
- [ ] Advanced analytics
- [ ] Mobile app

---

## 🎨 UI Inspiration

Design inspired by **[Specifai](https://github.com/presidio-oss/specif-ai)**:
- Indigo/slate color scheme
- Modern, clean interface
- Sidebar navigation
- Tree visualization
- Chat interface

---

## 🐛 Troubleshooting

### Backend Issues

**Database Connection**
```bash
# Check PostgreSQL running
# Verify DATABASE_URL in .env
```

**LLM API Error**
```bash
# Verify API key
# Check .env file
OPENAI_API_KEY=sk-...
```

**Port 8000 in Use**
```bash
# Change PORT in .env
PORT=8001
```

### Frontend Issues

**Cannot Connect to Backend**
```bash
# Verify backend is running
curl http://localhost:8000/health

# Check NEXT_PUBLIC_API_URL
```

**Scrolling Issues**
- Already fixed with overflow-y-auto
- Custom scrollbar styles applied

---

## 🚀 Deployment

### Backend
```bash
# Production with Docker
docker-compose -f docker-compose.prod.yml up

# Or with uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Frontend
```bash
# Build
npm run build

# Deploy to Vercel
vercel deploy

# Or self-host
npm run start
```

---

## 📖 Architecture

```
┌──────────────┐
│   Browser    │
└──────┬───────┘
       │ HTTP
       ▼
┌──────────────┐
│  Next.js UI  │
│  (Port 3000) │
└──────┬───────┘
       │ REST API
       ▼
┌──────────────┐
│   FastAPI    │
│  (Port 8000) │
└──────┬───────┘
       │
   ┌───┴────┬─────────┐
   │        │         │
   ▼        ▼         ▼
┌────┐  ┌─────┐  ┌──────┐
│ DB │  │ LLM │  │Redis │
└────┘  └─────┘  └──────┘
```

---

## 💡 Key Design Decisions

1. **FastAPI**: Modern, async, auto-documentation
2. **LangGraph**: Conversation state management
3. **PostgreSQL**: Relational tree structure
4. **Next.js**: Modern React, server components
5. **Tailwind**: Rapid UI development
6. **Tree Structure**: Natural requirement hierarchy
7. **Progressive Questioning**: Better than form dump
8. **Contextual Chat**: Per-feature exploration

---

## 🎯 Use Cases

1. **Software Agencies**: Gather client requirements
2. **Product Managers**: Define features
3. **Consultants**: Scope projects
4. **Developers**: Understand client needs
5. **Business Analysts**: Document requirements

---

## 📝 License

MIT

---

## 👥 Credits

- **MoMetric Team**
- **Specifai** - UI inspiration
- **FastAPI** - Backend framework
- **LangChain** - LLM integration

---

## 🆘 Getting Help

1. Check documentation in respective folders
2. Review API docs at `/api/docs`
3. Check logs for errors
4. Verify environment configuration

---

## ✅ Checklist for First Run

- [ ] PostgreSQL installed and running
- [ ] Python 3.11+ installed
- [ ] Node.js 18+ installed
- [ ] OpenAI API key obtained
- [ ] Backend .env configured
- [ ] Database created
- [ ] Backend running (port 8000)
- [ ] Frontend dependencies installed
- [ ] Frontend running (port 3000)
- [ ] Test upload works
- [ ] Test question flow works
- [ ] Test chat works

---

**🎉 You're ready to discover requirements with AI!**

**Version**: 1.0.0  
**Status**: ✅ Production Ready  
**Last Updated**: 2026-01-13
