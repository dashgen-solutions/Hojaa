"""
Setup script for creating .env file
"""
import os
from pathlib import Path

def create_env_file():
    """Create .env file from template."""
    env_content = """# Application
APP_NAME=MoMetric Requirements Discovery API
APP_VERSION=1.0.0
ENVIRONMENT=development
DEBUG=True

# Server
HOST=0.0.0.0
PORT=8000

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mometric_db
DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=20

# OpenAI - REPLACE WITH YOUR ACTUAL KEY
OPENAI_API_KEY=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
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_TEMPERATURE=0.7

# Anthropic Claude (alternative) - OPTIONAL
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-3-sonnet-20240229

# LLM Provider (openai or anthropic)
LLM_PROVIDER=openai

# Redis (optional)
REDIS_URL=redis://localhost:6379/0
REDIS_ENABLED=False

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
CORS_ALLOW_CREDENTIALS=True

# File Upload
MAX_FILE_SIZE_MB=10
ALLOWED_FILE_TYPES=.pdf,.doc,.docx,.txt

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json

# Security
SECRET_KEY=your-secret-key-change-this-in-production-use-random-string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
"""
    
    env_file = Path(".env")
    
    if env_file.exists():
        print("⚠️  .env file already exists!")
        response = input("Overwrite? (y/n): ")
        if response.lower() != 'y':
            print("Skipping .env creation")
            return
    
    with open(env_file, 'w') as f:
        f.write(env_content)
    
    print("✅ .env file created successfully!")
    print("\n⚠️  IMPORTANT: Edit .env and add your OPENAI_API_KEY!")
    print("   DATABASE_URL also needs to be configured if using PostgreSQL\n")

if __name__ == "__main__":
    create_env_file()
