# 🎯 Clean Codebase Quick Reference

## Your Cleaned Codebase

Your codebase is now **100% Pydantic AI** with clean, simple naming.

---

## 📁 Current File Structure

```
backend/app/
├── models/
│   ├── agent_models.py        ← Pydantic AI output models ✨
│   ├── schemas.py             ← API request/response schemas
│   └── database.py            ← SQLAlchemy database models
│
├── services/
│   ├── agent_service.py       ← Base agent creation service ✨
│   ├── question_generator.py  ← Question generation agent ✨
│   ├── tree_builder.py        ← Tree building agent ✨
│   ├── conversation_flow.py   ← Conversation agent ✨
│   └── document_analyzer.py   ← Document processing
│
├── api/routes/
│   ├── upload.py              ← Document upload + questions
│   ├── questions.py           ← Answer submission + tree
│   ├── chat.py                ← Feature exploration chat
│   ├── tree.py                ← Tree operations
│   ├── sessions.py            ← Session management
│   └── auth.py                ← Authentication
│
└── core/
    ├── config.py              ← Configuration
    ├── logger.py              ← Logging
    └── auth.py                ← Auth utilities
```

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Run Server

```bash
python run_dev.py
```

### 3. Test Endpoints

Visit: http://localhost:8000/api/docs

---

## 💡 Import Patterns

### Services
```python
from app.services.question_generator import question_generator
from app.services.tree_builder import tree_builder
from app.services.conversation_flow import conversation_flow
from app.services.agent_service import create_requirements_agent
```

### Models
```python
from app.models.agent_models import (
    QuestionGenerationOutput,
    TreeStructureOutput,
    ConversationStartOutput
)
```

---

## 🎨 Creating New Agents

### Step 1: Define Output Model

```python
# File: app/models/agent_models.py

class MyAgentOutput(BaseModel):
    """Your custom output."""
    field1: str
    field2: List[str]
```

### Step 2: Create Agent

```python
# File: app/services/my_agent.py

from app.services.agent_service import create_requirements_agent
from app.models.agent_models import MyAgentOutput

agent = create_requirements_agent(
    system_prompt="You are a specialized agent",
    result_type=MyAgentOutput
)

async def my_function(input_text: str):
    result = await agent.run(input_text)
    return result.data  # Validated MyAgentOutput
```

### Step 3: Use in Routes

```python
# File: app/api/routes/my_route.py

from app.services.my_agent import my_function

@router.post("/my-endpoint")
async def my_endpoint(data: str):
    result = await my_function(data)
    return {"result": result}
```

---

## 🔍 Key Services Explained

### `agent_service.py`
- Creates Pydantic AI agents
- Handles multi-provider support (OpenAI/Anthropic)
- Provides helper functions for common agent patterns

### `question_generator.py`
- Generates 10 initial discovery questions
- Adapts questions based on user type (technical/non-technical)
- Guaranteed validated output

### `tree_builder.py`
- Builds requirements tree from answers
- Expands nodes from conversations
- Maintains hierarchical context

### `conversation_flow.py`
- Manages feature exploration conversations
- Generates contextual questions
- Detects conversation completion

---

## 🧪 Testing

### Unit Test Example

```python
from pydantic_ai.models.test import TestModel
from app.services.agent_service import create_requirements_agent
from app.models.agent_models import QuestionGenerationOutput

def test_agent():
    test_model = TestModel()
    agent = create_requirements_agent(
        system_prompt="Test",
        result_type=QuestionGenerationOutput
    )
    
    test_model.add_response({
        "questions": [...]  # Mock data
    })
    
    result = agent.run_sync("test")
    assert len(result.data.questions) == 10
```

---

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload/{session_id}` | POST | Upload document → Generate questions |
| `/api/questions/submit` | POST | Submit answers → Build tree |
| `/api/chat/start` | POST | Start feature conversation |
| `/api/chat/message` | POST | Send chat message |
| `/api/chat/confirm` | POST | Confirm chat → Expand tree |
| `/api/tree/{session_id}` | GET | Get requirements tree |
| `/api/sessions` | GET | List sessions |

---

## 🎯 Multi-Agent Patterns

### Pattern 1: Specialized Agents

```python
# Technical agent
technical_agent = create_requirements_agent(
    system_prompt="You are a technical architect",
    result_type=TechnicalOutput
)

# Business agent
business_agent = create_requirements_agent(
    system_prompt="You are a business analyst",
    result_type=BusinessOutput
)

# Route based on user type
if user_type == "technical":
    result = await technical_agent.run(prompt)
else:
    result = await business_agent.run(prompt)
```

### Pattern 2: Agent Pipeline

```python
# Step 1: Extract requirements
requirements = await requirements_agent.run(document)

# Step 2: Validate
validated = await validation_agent.run(requirements.data)

# Step 3: Prioritize
prioritized = await priority_agent.run(validated.data)
```

### Pattern 3: Parallel Processing

```python
import asyncio

tasks = [
    agent1.run(prompt1),
    agent2.run(prompt2),
    agent3.run(prompt3)
]

results = await asyncio.gather(*tasks)
```

---

## 🔧 Configuration

### Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-your-key
DATABASE_URL=postgresql://user:pass@localhost/db
SECRET_KEY=your-secret

# Optional
LLM_PROVIDER=openai  # or "anthropic"
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_TEMPERATURE=0.7
```

---

## ⚡ Performance Tips

### 1. Cache Agents
```python
from functools import lru_cache

@lru_cache
def get_agent():
    return create_requirements_agent(...)

agent = get_agent()  # Reuse same agent
```

### 2. Use Faster Models
```python
# Fast
agent = Agent("openai:gpt-4o-mini")

# Powerful
agent = Agent("openai:gpt-4-turbo-preview")
```

### 3. Adjust Temperature
```python
# Deterministic (faster)
result = await agent.run(prompt, model_settings={"temperature": 0.0})

# Creative (slower)
result = await agent.run(prompt, model_settings={"temperature": 1.5})
```

---

## 📚 Documentation Files

### Essential Docs (Keep)
- ✅ `README.md` - Complete backend documentation
- ✅ `QUICKSTART.md` - 5-minute setup guide
- ✅ `PROJECT_STRUCTURE.md` - Architecture details
- ✅ `INTEGRATION_GUIDE.md` - Frontend integration
- ✅ `PROJECT_SUMMARY.md` - Project overview
- ✅ `CODE_CLEANUP_SUMMARY.md` - What was cleaned
- ✅ `CLEAN_CODEBASE_GUIDE.md` - This file

### Migration Docs (Optional - Can Remove)
- ⚠️ `MIGRATION_COMPLETE.md` - References old structure
- ⚠️ `PYDANTIC_AI_MIGRATION.md` - Migration guide (historical)
- ⚠️ `PYDANTIC_AI_QUICKSTART.md` - Has old import paths
- ⚠️ `START_HERE.md` - References old "ai_" naming

---

## 🆘 Common Issues

### Import Error: `pydantic_ai` not found

```bash
pip install pydantic-ai pydantic-ai-slim[openai,anthropic]
```

### Import Error: Module not found

```bash
# Check you're in the right directory
cd c:\work\Mometric_Mouaaz\backend

# Activate virtual environment
venv\Scripts\activate

# Reinstall
pip install -r requirements.txt
```

### Agent Validation Errors

Increase retries:
```python
agent = create_requirements_agent(
    system_prompt="...",
    result_type=OutputModel,
    retries=5  # Default is 2
)
```

---

## ✅ Quick Validation

Test your setup:

```bash
# 1. Check Python can import
python -c "from app.services.question_generator import question_generator; print('✅ OK')"

# 2. Start server
python run_dev.py

# 3. Test endpoint
curl http://localhost:8000/health
```

---

## 🎉 You're Ready!

Your codebase is:
- ✅ **Clean** (no legacy code)
- ✅ **Simple** (single implementation)
- ✅ **Type-safe** (Pydantic validation)
- ✅ **Ready** (for multi-agent workflows)

**Start building:** Create specialized agents, implement workflows, or add new features!

---

**Questions?**
- Check `CODE_CLEANUP_SUMMARY.md` for what changed
- Review services in `app/services/`
- Check models in `app/models/agent_models.py`

🚀 **Happy coding with clean Pydantic AI!**
