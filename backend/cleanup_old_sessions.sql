-- Script to clean up old/demo sessions from the database
-- This will delete all sessions that don't belong to any registered user

-- First, let's see what we have:
-- SELECT 
--   id, 
--   user_id, 
--   document_filename, 
--   status, 
--   created_at 
-- FROM sessions 
-- ORDER BY created_at DESC;

-- Delete all guest sessions (sessions with no user_id)
DELETE FROM sessions WHERE user_id IS NULL;

-- Verify the cleanup
SELECT COUNT(*) as remaining_sessions FROM sessions;
SELECT COUNT(*) as sessions_with_users FROM sessions WHERE user_id IS NOT NULL;
