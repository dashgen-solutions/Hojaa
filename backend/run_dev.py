"""
Development server runner with auto-reload.
"""
import uvicorn
import sys
import os
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

if __name__ == "__main__":
    print("Starting Hojaa API")
    print("Server will be at: http://localhost:8000")
    print("API Docs will be at: http://localhost:8000/api/docs")
    # NOTE:
    # Some environments (sandboxed terminals, restricted filesystems, CI, etc.)
    # block file watchers used by Uvicorn's --reload and will fail with
    # "[Errno 1] Operation not permitted".
    #
    # To run reliably everywhere, auto-reload is OPT-IN:
    #   MOMETRIC_RELOAD=1 python run_dev.py
    enable_reload = os.getenv("HOJAA_RELOAD", os.getenv("MOMETRIC_RELOAD", "0")) == "1"
    print(f"Auto-reload is {'ENABLED' if enable_reload else 'DISABLED'} (set HOJAA_RELOAD=1 to enable)\n")

    if enable_reload:
        try:
            uvicorn.run(
                "app.main:app",
                host="0.0.0.0",
                port=8000,
                reload=True,
                log_level="info",
            )
        except BaseException as e:
            if isinstance(e, KeyboardInterrupt):
                raise
            print(
                f"Auto-reload failed ({type(e).__name__}: {e}). "
                "Restarting with auto-reload DISABLED.\n"
            )
            uvicorn.run(
                "app.main:app",
                host="0.0.0.0",
                port=8000,
                reload=False,
                log_level="info",
            )
    else:
        uvicorn.run(
            "app.main:app",
            host="0.0.0.0",
            port=8000,
            reload=False,
            log_level="info",
        )
