# Hojaa v1.2 Release Notes

**Release Date:** March 26, 2026

---

## New Features

### Document Approval Workflow
Documents now support a full approval lifecycle. Send documents for review, and approvers can approve or reject with comments. Track approval status directly from the document editor and list views.

- Request approval from specific team members
- Approve/reject with comments
- Approval status visible in document list
- Email notifications for approval requests

### User Profile Page & Avatars
New dedicated `/profile` page where users can:
- Upload a profile avatar
- Edit personal details
- View their account information

Clicking a user anywhere in the messaging interface opens a profile modal with their details and status.

### Call Transcriptions Panel
View and browse transcriptions from recorded calls in a dedicated panel. Transcriptions include timestamps and speaker identification.

### Google Gemini LLM Support
Hojaa now supports Google Gemini as a third AI provider alongside OpenAI and Anthropic. Configure it from the integrations settings page.

### Messaging Connection Context
Shared WebSocket connection management prevents duplicate connections when navigating between pages, improving reliability and reducing server load.

---

## Fixes & Improvements

### SMTP Email Fix
- Docker containers now properly receive SMTP environment variables
- Document share emails work reliably in production
- Added `DOCKER_SMTP.md` troubleshooting guide

### PDF Export Font Fix
- Fixed font rendering issues in PDF exports
- Documents now render correctly with proper typography

### Integrations API Refactor
- Complete rewrite of the integrations route for better reliability
- Cleaner error handling and validation
- API key masking in responses

### AI Usage Tracking Rewrite
- Rewritten usage tracking and limit enforcement service
- More accurate per-user and per-org usage metering

### UI Improvements
- Mermaid diagram rendering improved with better error handling
- Message composer UX enhancements
- Emoji picker stability fixes
- Channel list performance improvements
- Export modal reworked for cleaner flow
- Settings page UI refresh
- Tree node visualization refactored for better performance

---

## Database Migrations

5 new migrations (run automatically on deploy):

| Migration | Description |
|-----------|-------------|
| `0014` | Add user `avatar_url` column |
| `0015` | Add call transcription `audio_url` |
| `0016` | Add call transcription `title` |
| `0017` | Add Gemini to integration types enum |
| `0018` | Add `document_approvals` table |

---

## Cumulative Feature Set (v1.0 - v1.2)

For LinkedIn and marketing reference, here's everything Hojaa offers as of v1.2:

### Core Platform
- AI-powered requirements discovery with guided questionnaires
- Multi-level feature tree generation (2-4 levels deep)
- Planning board with AI-generated task cards
- Scope change detection and approval workflows
- Team collaboration with role-based access (Owner, Admin, Member)
- Organization multi-tenancy

### Documents
- Block-based rich text editor (BlockNote)
- AI chat assistant for document generation and editing
- Template system with variables
- Pricing table blocks
- Mermaid diagram rendering (flowcharts, Gantt, sequence, pie, mindmaps)
- Version history and auto-save
- PDF and DOCX export with Mermaid images
- Document sharing via public links
- Document approval workflow (new in v1.2)

### Messaging & Communication
- Slack-style real-time messaging with channels
- Threaded replies and message pinning
- Emoji reactions and @mentions
- File attachments
- Message search
- WebRTC audio/video calling (1:1 and group)
- Call recording and transcription
- Channel AI chatbot with function-calling tools
- User status with custom emoji

### Infrastructure
- Multi-provider AI support (OpenAI, Anthropic, Gemini)
- AI usage limits and metering
- SMTP email notifications
- API key management via UI
- Audit timeline for project history

---

## LinkedIn Post Draft

We just shipped Hojaa v1.2, and the Documents module keeps getting smarter.

**Document Approvals** - Send documents for review, get approvals with comments, track status. The full lifecycle from draft to sign-off, built in.

**Google Gemini Support** - Hojaa now works with OpenAI, Anthropic, and Google Gemini. Choose the AI provider that works best for your team.

**User Profiles & Avatars** - Personalize your workspace with profile photos and see teammate profiles across the app.

**Call Transcriptions** - Browse transcriptions from recorded calls with timestamps and speaker labels.

Plus SMTP email fixes, improved PDF exports, and a major rewrite of our integrations and AI usage tracking systems.

Here's what Hojaa does end-to-end:
- Discover requirements through AI-guided conversations
- Generate multi-level feature trees automatically
- Plan work with AI-generated task cards
- Write proposals and SOWs with an AI document editor
- Communicate in real-time with messaging, video calls, and channel AI bots
- Export polished PDFs and DOCX with diagrams
- Share documents via public links and track approvals

From first client call to signed proposal, all in one platform.

Try it out: [your-url-here]

#ProductManagement #SaaS #AI #StartupLife #BuildInPublic
