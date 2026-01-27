-- Migration: Add user_type column to sessions table
-- Date: 2026-01-21
-- Description: Adds user_type field to support technical vs non-technical users

-- Add the user_type column with default value
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) DEFAULT 'non_technical' NOT NULL;

-- Update existing sessions to have default value
UPDATE sessions 
SET user_type = 'non_technical' 
WHERE user_type IS NULL;

-- Verify the change
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'sessions' AND column_name = 'user_type';
