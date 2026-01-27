-- Cleanup script to remove guest sessions (sessions with no user_id)
-- Run this ONCE to clean up old guest sessions from before authentication was implemented

-- OPTION 1: Delete ALL guest sessions (use this if you want to start fresh)
DELETE FROM sessions WHERE user_id IS NULL;

-- OPTION 2: Keep guest sessions, but don't show them to authenticated users
-- (This is already handled in the code, so you don't need to run anything)

-- To verify: Check how many guest sessions exist
-- SELECT COUNT(*) FROM sessions WHERE user_id IS NULL;
