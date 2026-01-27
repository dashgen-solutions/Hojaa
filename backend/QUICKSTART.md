# 🚀 Backend Quick Start Guide

Get the MoMetric Requirements Discovery API running in **under 5 minutes**!

## ⚡ Option 1: Docker (Recommended)

The fastest way to get started!

### Prerequisites
- Docker & Docker Compose installed

### Steps

1. **Create `.env` file** in backend directory:
```bash
cd backend
echo "OPENAI_API_KEY=sk-your-actual-key-here" > .env
```

2. **Start everything**:
```bash
docker-compose up
```

That's it! API running at **http://localhost:8000** 🎉

### Test it:
```bash
curl http://localhost:8000/health
```

---

## 🐍 Option 2: Local Python

### Prerequisites
- Python 3.11+
- PostgreSQL 14+

### Quick Steps

```bash
# 1. Navigate to backend
cd backend

# 2. Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Mac/Linux

# 3. Install dependencies
pip install -r requirements.txt

# 4. Create .env file
copy .env.example .env  # Windows
# cp .env.example .env  # Mac/Linux

# 5. Edit .env - add your keys
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mometric_db
# OPENAI_API_KEY=sk-your-actual-key

# 6. Create database
# In PostgreSQL:
# CREATE DATABASE mometric_db;

# 7. Run server
python -m app.main
```

Server at **http://localhost:8000** ✅

---

## 📝 Minimal .env Configuration

Create `.env` with these minimum settings:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mometric_db
OPENAI_API_KEY=sk-your-actual-openai-key
SECRET_KEY=change-this-to-random-string
CORS_ORIGINS=http://localhost:3000
```

---

## 🧪 Test the API

### 1. Health Check
```bash
curl http://localhost:8000/health
```

### 2. View API Docs
Open browser: **http://localhost:8000/api/docs**

### 3. Upload Test Document
```bash
curl -X POST http://localhost:8000/api/upload \
  -F "text=I want to build a chatbot for customer support"
```

You should get back 10 questions!

---

## 🔗 Connect Frontend

Update frontend API base URL:

**File**: `requirements-discovery-ui/src/app/api/chat/route.ts`

Change to:
```typescript
const API_BASE = 'http://localhost:8000';
```

---

## 🐛 Troubleshooting

### Port 8000 already in use
```bash
# Kill existing process
# Windows:
netstat -ano | findstr :8000
taskkill /PID <process_id> /F

# Mac/Linux:
lsof -ti:8000 | xargs kill -9
```

### Database connection failed
```bash
# Check PostgreSQL is running
# Windows: Check Services
# Mac/Linux:
sudo service postgresql status
```

### Import errors
```bash
# Make sure venv is activated
venv\Scripts\activate

# Reinstall
pip install -r requirements.txt
```

---

## 📚 Next Steps

1. ✅ **API is running**
2. ✅ **Test with Swagger UI** at `/api/docs`
3. ✅ **Connect frontend**
4. 🚀 **Start building!**

---

## 🎯 API Workflow

```
1. POST /api/upload → Get session_id + 10 questions
2. POST /api/questions/submit → Get tree
3. POST /api/chat/start → Start feature chat
4. POST /api/chat/message → Continue chat
5. POST /api/chat/confirm → Add nodes to tree
```

---

## 📖 Full Documentation

See **README.md** for complete documentation.

---

**Need help?** Check logs in console or visit `/api/docs`!
