"""
Cleanup script to remove guest sessions (sessions with no user_id)
Run this ONCE to clean up old guest sessions from before authentication was implemented
"""
from app.db.session import engine
from sqlalchemy import text

def cleanup_guest_sessions():
    try:
        with engine.connect() as conn:
            # Delete all sessions where user_id is NULL
            result = conn.execute(text('DELETE FROM sessions WHERE user_id IS NULL'))
            conn.commit()
            print(f'✅ Successfully deleted {result.rowcount} guest sessions')
            return result.rowcount
    except Exception as e:
        print(f'❌ Error cleaning up sessions: {str(e)}')
        raise

if __name__ == "__main__":
    print("Starting cleanup of guest sessions...")
    count = cleanup_guest_sessions()
    print(f"\n🎉 Cleanup complete! Removed {count} sessions.")
