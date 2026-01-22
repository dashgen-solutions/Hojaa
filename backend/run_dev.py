"""
Development server runner with auto-reload.
"""
import uvicorn
import sys
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

if __name__ == "__main__":
    print("Starting MoMetric Requirements Discovery API")
    print("Server will be at: http://localhost:8000")
    print("API Docs will be at: http://localhost:8000/api/docs")
    print("Auto-reload is ENABLED\n")
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
