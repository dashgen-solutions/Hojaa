# Hojaa v1.1 Release Notes

**Release Date:** March 2026

---

## New Features

### WebRTC Audio & Video Calling
Real-time 1:1 and group calling built directly into Hojaa's messaging system. Start audio or video calls from any channel with mute, camera toggle, and participant management. Group calls use mesh topology for low-latency peer-to-peer connections.

- Call recording with one-click start/stop
- Automatic call transcription
- Call event messages in chat (started, ended, missed)
- Full-screen call overlay with participant grid

### Channel AI Chatbot
Every messaging channel now has an AI assistant that understands your conversation context. Ask it to:

- Summarize recent discussions
- Search through message history
- Review call transcriptions
- Find key decisions and action items
- Track channel activity over any time period

The chatbot uses function-calling to pull real channel data before responding, giving you accurate, context-aware answers.

### Slack-Style User Status
Set a custom status with emoji to let your team know what you're up to. Choose from quick presets (In a meeting, Working remotely, Focusing, Out sick) or write your own. Status is visible across the messaging interface.

### Mermaid Diagram Rendering
Technical diagrams written in Mermaid syntax now render as visual diagrams in:
- Document editor (live preview)
- PDF exports (rendered as images)
- DOCX exports (rendered as images)
- Shared document links

### Document Sharing via Public Links
Generate shareable links for documents with token-based access. Recipients can view the full document including rendered Mermaid diagrams without needing a Hojaa account.

### Pricing Table in Documents
Insert pricing tables directly into documents from the pricing panel with a single click.

### Deep AI-Generated Feature Trees
The AI now generates multi-level feature trees (2-4 levels deep) instead of flat single-level trees, producing richer and more detailed project breakdowns.

---

## UI/UX Improvements

- **Chat header stays visible** - The chat header with approve buttons no longer scrolls out of view when messages load
- **Emoji picker portal rendering** - Emoji picker no longer gets clipped by parent containers
- **@mention display** - Mentions show readable @username in the composer instead of raw syntax
- **Tree node outside-click dismiss** - Dropdown menus on tree nodes close when clicking outside
- **Layout flex chain fix** - Content areas properly fill the viewport on all screen sizes
- **Responsive chatbot sizing** - Project chatbot adapts to viewport height instead of fixed dimensions
- **Add Members modal** - Search and add members to channels with a clean full-screen modal
- **Group Members panel** - View online/offline members with status indicators

---

## Backend & Infrastructure

- 5 new database migrations for messaging, status, call transcriptions
- AI usage limits enforced across all 14 LLM-powered endpoints
- Comprehensive test coverage: call signaling (20 tests), document features, messaging, UX improvements
- API key onboarding dialog for new users

---

## LinkedIn Post Draft

Excited to share what we've been building at Hojaa!

Our latest release brings real-time communication directly into the product discovery workflow:

**WebRTC Calling** - Start audio or video calls from any channel. 1:1 or group calls with recording and automatic transcription.

**Channel AI Chatbot** - Every channel gets an AI assistant that can summarize discussions, search messages, and surface key decisions from your conversations.

**Slack-Style Status** - Let your team know if you're in a meeting, focusing, or working remotely.

**Mermaid Diagrams** - Technical diagrams render beautifully in documents, exports, and shared links.

**Smarter Feature Trees** - AI now generates multi-level feature hierarchies for deeper project breakdowns.

Plus dozens of UI/UX improvements to make the experience smoother.

Hojaa helps product teams go from discovery conversations to structured plans, all in one place.

#ProductManagement #SaaS #AI #WebRTC #StartupLife
