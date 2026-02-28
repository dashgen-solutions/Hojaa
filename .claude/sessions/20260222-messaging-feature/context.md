# Session Context: Global Team Messaging Feature

## What We Built
A platform-level "mini Slack" messaging system within Hojaa. This is NOT project-specific — it's a global feature where users communicate via DMs and group channels, with optional references to projects/tasks.

## Architecture Decisions

- **Separate WebSocket manager**: Messaging uses its own `MessagingConnectionManager` keyed by `user_id`, not the existing session-scoped `ConnectionManager`. This avoids coupling messaging to project sessions.
- **Organization-scoped**: All channels and messaging queries are scoped to the current user's organization. Users can only message members of their own org.
- **DM deduplication**: Creating a DM with someone who you already have a DM channel with returns the existing channel instead of creating a duplicate.
- **Unread tracking via `last_read_at`**: Each `ChatChannelMember` has a `last_read_at` timestamp. Unread count = messages where `created_at > last_read_at`. Simpler than per-message read receipts.
- **Local React state, not Zustand**: Messaging page uses local useState/useEffect, not the global Zustand store. Keeps it self-contained.
- **Sidebar unread polling**: Sidebar polls `GET /api/messaging/unread` every 30 seconds for the badge count. Pragmatic until WebSocket events are wired into sidebar context.
- **Real-time broadcast pattern**: REST endpoints (send/edit/delete message) fire `asyncio.get_event_loop().create_task()` to broadcast via WebSocket. Fire-and-forget delivery to online members.
- **Hojaa brand design**: Neon lime (#E4FF1A) accents, dark mode support (`dark:bg-[#060606]`), Outfit + DM Sans fonts, consistent with the Hojaa design system.

## Key Constraints
- Docker Compose 3-service architecture: db (port 5434), api (port 8000), web (port 3002)
- Alembic auto-migration on startup handles new tables
- JWT auth required for all messaging endpoints
- Native browser WebSocket (not socket.io)

## Tech Stack
- Backend: FastAPI + SQLAlchemy + PostgreSQL + Alembic
- Frontend: Next.js 14 App Router + TypeScript + Tailwind CSS
- Auth: JWT with `get_current_user` dependency
- Real-time: Native WebSocket with auto-reconnect + exponential back-off
