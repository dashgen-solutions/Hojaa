-- Performance indexes for MoMetric Requirements Discovery System
-- Run this after database_migration.sql to add optimized indexes

-- ================================================================
-- SESSION INDEXES
-- ================================================================

-- Index for user's sessions sorted by creation date (most common query)
CREATE INDEX IF NOT EXISTS idx_sessions_user_id_created 
ON sessions(user_id, created_at DESC) 
WHERE user_id IS NOT NULL;

-- Index for filtering sessions by status
CREATE INDEX IF NOT EXISTS idx_sessions_status 
ON sessions(status);

-- Index for guest sessions cleanup (sessions without user_id)
CREATE INDEX IF NOT EXISTS idx_sessions_guest_created 
ON sessions(created_at DESC) 
WHERE user_id IS NULL;

-- ================================================================
-- NODE INDEXES
-- ================================================================

-- Index for tree queries (getting children of a parent in order)
CREATE INDEX IF NOT EXISTS idx_nodes_session_parent 
ON nodes(session_id, parent_id, order_index);

-- Index for depth-based queries (useful for tree traversal)
CREATE INDEX IF NOT EXISTS idx_nodes_depth_order 
ON nodes(depth, order_index);

-- Index for finding expandable nodes
CREATE INDEX IF NOT EXISTS idx_nodes_expandable 
ON nodes(session_id, can_expand, is_expanded) 
WHERE can_expand = TRUE;

-- Index for node type filtering
CREATE INDEX IF NOT EXISTS idx_nodes_type 
ON nodes(node_type);

-- ================================================================
-- QUESTION INDEXES
-- ================================================================

-- Index for getting answered/unanswered questions by session
CREATE INDEX IF NOT EXISTS idx_questions_session_answered 
ON questions(session_id, is_answered, order_index);

-- Index for ordering questions
CREATE INDEX IF NOT EXISTS idx_questions_order 
ON questions(session_id, order_index);

-- ================================================================
-- CONVERSATION INDEXES
-- ================================================================

-- Index for finding conversations by session and node
CREATE INDEX IF NOT EXISTS idx_conversations_session_node 
ON conversations(session_id, node_id);

-- Index for filtering active/completed conversations
CREATE INDEX IF NOT EXISTS idx_conversations_status 
ON conversations(status);

-- Index for finding active conversations for a session
CREATE INDEX IF NOT EXISTS idx_conversations_session_status 
ON conversations(session_id, status) 
WHERE status = 'active';

-- ================================================================
-- MESSAGE INDEXES
-- ================================================================

-- Index for getting conversation messages in order
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
ON messages(conversation_id, created_at);

-- Index for filtering messages by role
CREATE INDEX IF NOT EXISTS idx_messages_role 
ON messages(conversation_id, role);

-- ================================================================
-- USER INDEXES
-- ================================================================

-- Index for user authentication (email lookup with active status)
CREATE INDEX IF NOT EXISTS idx_users_email_active 
ON users(email, is_active) 
WHERE is_active = TRUE;

-- Index for username lookup
CREATE INDEX IF NOT EXISTS idx_users_username_active 
ON users(username, is_active) 
WHERE is_active = TRUE;

-- ================================================================
-- COMPOSITE INDEXES FOR COMMON QUERIES
-- ================================================================

-- Index for tree visualization (session + parent + depth + order)
CREATE INDEX IF NOT EXISTS idx_nodes_tree_view 
ON nodes(session_id, parent_id, depth, order_index);

-- Index for conversation flow (session + node + status + created)
CREATE INDEX IF NOT EXISTS idx_conversations_flow 
ON conversations(session_id, node_id, status, created_at DESC);

-- ================================================================
-- VERIFICATION
-- ================================================================

-- View all created indexes
-- SELECT 
--     schemaname,
--     tablename,
--     indexname,
--     indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
-- ORDER BY tablename, indexname;

-- ================================================================
-- NOTES
-- ================================================================
-- 
-- These indexes are optimized for:
-- 1. User session listing and filtering
-- 2. Tree traversal and node expansion
-- 3. Question ordering and filtering
-- 4. Conversation message retrieval
-- 5. User authentication
-- 
-- Monitor index usage with:
-- SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public';
-- 
-- If an index is rarely used (low idx_scan), consider dropping it.
-- ================================================================
