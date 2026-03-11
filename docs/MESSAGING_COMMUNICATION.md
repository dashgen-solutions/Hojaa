# Messaging & Communication — Feature Documentation

> All new functions, components, hooks, APIs, and backend services implemented for the Hojaa messaging and communication system.

---

## Table of Contents

1. [WebRTC Calling System](#1-webrtc-calling-system)
2. [Messaging WebSocket Enhancements](#2-messaging-websocket-enhancements)
3. [Channel AI Chatbot](#3-channel-ai-chatbot)
4. [User Custom Status (Slack-style)](#4-user-custom-status-slack-style)
5. [EmojiPicker Portal Fix](#5-emojipicker-portal-fix)
6. [StatusPicker Component](#6-statuspicker-component)
7. [Mention Display Fix](#7-mention-display-fix)
8. [Group Members Panel & Add Members Modal](#8-group-members-panel--add-members-modal)
9. [Call Transcription System](#9-call-transcription-system)
10. [Database Migrations](#10-database-migrations)
11. [API Client Functions](#11-api-client-functions)
12. [Test Coverage](#12-test-coverage)

---

## 1. WebRTC Calling System

### Hook: `useWebRTCCall`

**File:** `web/src/hooks/useWebRTCCall.ts` (new)

A full-featured React hook for WebRTC audio/video calling supporting both **1:1 calls** and **group calls** (mesh topology).

#### Exports

| Export | Type | Description |
|--------|------|-------------|
| `CallState` | Type | `'idle' \| 'calling' \| 'ringing' \| 'connected' \| 'ended'` |
| `CallType` | Type | `'audio' \| 'video'` |
| `CallInfo` | Interface | Remote user info, channel, call type, caller/group flags |
| `CallParticipant` | Interface | `{ userId, userName, stream }` for group call members |
| `useWebRTCCall()` | Hook | Main hook accepting `{ currentUserId, currentUserName, sendWsMessage }` |

#### Returned State & Methods

**State:**
- `callState` — current state of the call
- `callInfo` — metadata about the active call
- `isMuted`, `isVideoOff` — toggle states
- `callDuration` — seconds elapsed (auto-incrementing timer)
- `participants` — array of `CallParticipant` (group calls)
- `isRecording`, `recordingBlob` — call recording state

**1:1 Call Methods:**
- `startCall(targetUserId, targetUserName, channelId, callType)` — initiate a call
- `acceptCall(callerUserId)` — accept an incoming call
- `rejectCall()` — decline an incoming call
- `endCall()` — hang up the current call

**Group Call Methods:**
- `startGroupCall(memberIds, channelId, channelName, callType)` — ring all channel members
- `acceptGroupCall(callerUserId)` — join a group call

**Shared Controls:**
- `toggleMute()` — toggle microphone
- `toggleVideo()` — toggle camera

**Recording:**
- `startRecording()` — begin recording call audio (mixes local + remote)
- `stopRecording()` — stop recording
- `clearRecording()` — discard the recorded blob

**WS Handlers (wire to WebSocket):**
- `handleCallIncoming`, `handleCallAccepted`, `handleCallRejected`, `handleCallEnded`
- `handleWebRTCOffer`, `handleWebRTCAnswer`, `handleWebRTCIceCandidate`
- `handleGroupCallParticipantJoined`, `handleGroupCallParticipantLeft`

#### Key Design Decisions

- **Ref-based state mirroring:** `callStateRef` and `callInfoRef` mirror React state so WS handler identities never change (prevents WebSocket reconnection cycles).
- **STUN servers:** Uses `stun.l.google.com:19302` for NAT traversal.
- **ICE candidate buffering:** Candidates received before remote description is set are queued in `pendingCandidatesRef` and applied after `setRemoteDescription`.
- **Group mesh topology:** Each participant creates a dedicated `RTCPeerConnection` to every other participant.
- **Call recording:** Uses `AudioContext` mixing to combine local + remote streams into a single `MediaRecorder` output (WebM/Opus).

---

### Component: `CallOverlay`

**File:** `web/src/components/messaging/CallOverlay.tsx` (new)

Full-screen call UI rendered based on call state:

| State | UI |
|-------|----|
| `ringing` (callee) | Incoming call modal with Accept/Reject buttons, pulsing avatar |
| `calling` (caller) | Outgoing call modal with Cancel button |
| `connected` | Full-screen call view with video/audio, mute/video/record controls |

**Group call features:**
- Dynamic grid layout with `tileSize()` function (adjusts based on participant count)
- Per-participant `<video>` elements via `ParticipantVideo` component
- Hidden `<audio>` elements via `ParticipantAudio` for audio-only participants

---

## 2. Messaging WebSocket Enhancements

**File:** `web/src/hooks/useMessagingWebSocket.ts` (modified)

### New Callbacks Added

| Callback | WS Message Type | Purpose |
|----------|----------------|---------|
| `onCallIncoming` | `call_incoming` | Incoming call notification |
| `onCallAccepted` | `call_accepted` | Call accepted by callee |
| `onCallRejected` | `call_rejected` | Call declined by callee |
| `onCallEnded` | `call_ended` | Call ended by other party |
| `onWebRTCOffer` | `webrtc_offer` | WebRTC SDP offer received |
| `onWebRTCAnswer` | `webrtc_answer` | WebRTC SDP answer received |
| `onWebRTCIceCandidate` | `webrtc_ice_candidate` | ICE candidate received |
| `onGroupCallParticipantJoined` | `group_call_participant_joined` | New participant joined group call |
| `onGroupCallParticipantLeft` | `group_call_participant_left` | Participant left group call |
| `onStatusUpdate` | `status_update` | User status changed |

### New Return Value

- `sendWsMessage(data: Record<string, unknown>)` — generic WS message sender used by call signaling

### Architecture Change

- **Before:** Each callback was destructured from props and listed in `useCallback` dependency arrays, causing WS reconnection on any handler change.
- **After:** All handlers stored in a single `handlersRef`. Only `token`, `enabled`, and `cleanup` are in the dependency array — WS connection is stable regardless of handler changes.

---

## 3. Channel AI Chatbot

### Backend Service: `messaging_chat_service.py`

**File:** `backend/app/services/messaging_chat_service.py` (new)

AI-powered chatbot scoped to a specific chat channel. Uses OpenAI function calling with 6 channel-specific tools:

| Tool | Description |
|------|-------------|
| `get_channel_info` | Channel name, type, member count, message/transcription counts |
| `get_recent_messages` | Latest messages with sender names, content, timestamps (optional search filter) |
| `get_call_transcriptions` | Call transcriptions with initiator, duration, participants |
| `search_messages` | Keyword search across channel messages |
| `get_channel_members` | All members with usernames and join dates |
| `summarize_discussion` | Aggregated messages + transcriptions for AI summarization (configurable hours) |

**Key function:** `process_messaging_chat(db, channel_id, user_id, user_message, chat_history)`

- Enforces AI usage limits via `enforce_ai_limit()`
- Supports up to 5 tool-call iterations per request
- Logs token usage via `log_usage()`
- Returns `{ response, tool_calls }` with tool call preview data

### Backend Routes: `messaging_chat.py`

**File:** `backend/app/api/routes/messaging_chat.py` (new)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/messaging-chat/send` | POST | Send message to channel chatbot |
| `/api/messaging-chat/history/{channel_id}` | GET | Get chatbot conversation history |
| `/api/messaging-chat/history/{channel_id}` | DELETE | Clear chatbot conversation history |

All endpoints require authentication and verify channel membership.

### Frontend Component: `MessagingChatbot`

**File:** `web/src/components/messaging/MessagingChatbot.tsx` (new)

Floating chatbot panel with:
- **FAB trigger button** (fixed bottom-right, indigo)
- **Chat panel** (420px wide, 560px tall, animated slide-in)
- **Quick actions** (5 preset prompts: summarize, call transcriptions, decisions, search, activity)
- **Message rendering** with custom `MarkdownRenderer` (headers, bold, italic, code blocks, tables, lists, blockquotes)
- **Tool calls display** (shows which tools the AI used per response)
- **Auto-scroll**, channel-aware history loading, clear history

---

## 4. User Custom Status (Slack-style)

### Backend Changes

**Migration:** `backend/alembic/versions/20260311_0012_add_user_custom_status.py`
- Added `custom_status` (String 200) and `status_emoji` (String 10) columns to `users` table

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/messaging/status` | GET | Get current user's status |
| `/api/messaging/status` | PUT | Update current user's status |

### Frontend Integration

- `ChatChannelMemberInfo` extended with `custom_status` and `status_emoji`
- `UserPresenceInfo` extended with `custom_status` and `status_emoji`
- `getMyStatus()` and `updateMyStatus()` API functions in `web/src/lib/api.ts`

---

## 5. EmojiPicker Portal Fix

**File:** `web/src/components/messaging/EmojiPicker.tsx` (modified)

### Problem
Emoji picker was getting clipped by parent containers with `overflow: hidden`.

### Solution
- Converted to use `React.createPortal()` rendering at `document.body`
- Uses `fixed` positioning calculated from anchor element's bounding rect
- Added `anchorRef` for position calculation
- Category tabs changed from `flex-1` to `flex-shrink-0` with `overflow-x-auto scrollbar-hide` for horizontal scrolling when many categories

---

## 6. StatusPicker Component

**File:** `web/src/components/messaging/StatusPicker.tsx` (new)

Slack-style status picker with:
- Emoji selector (24 common emojis in 8-column grid)
- Text input with 200-char limit
- 8 quick presets (In a meeting, Commuting, Out sick, Vacationing, Working remotely, DND, Focusing, On a break)
- Outside-click and Escape key to close
- Save and Clear actions

### Portal Rendering in Messages Page

**File:** `web/src/app/(app)/messages/page.tsx` (modified)

- StatusPicker rendered via `createPortal()` at `document.body` with `fixed` positioning
- Position calculated from `statusBarRef` element's bounding rect
- Prevents clipping by overflow containers

---

## 7. Mention Display Fix

**File:** `web/src/components/messaging/MessageComposerEnhanced.tsx` (modified)

### Problem
@mentions were showing raw `@[username](userId)` syntax in the textarea.

### Solution
- Added `mentionMap` state (`Map<string, string>` mapping username → userId)
- `insertMention()` now inserts only `@username` in the textarea (human-readable)
- `handleSend()` reconstructs `@[username](userId)` syntax from the mentionMap before sending to the server
- Map is cleared after each send

---

## 8. Group Members Panel & Add Members Modal

### GroupMembersPanel

**File:** `web/src/components/messaging/GroupMembersPanel.tsx` (new)

Side panel (300px) showing channel members split into Online/Offline sections:
- Avatar with gradient background and online indicator dot
- Username, custom status emoji, and status text display
- "Add People" button opening the AddMembersModal
- Member count in header

### AddMembersModal

**File:** `web/src/components/messaging/AddMembersModal.tsx` (new)

Full-screen modal for adding members to a channel:
- Search input with debounced user lookup (300ms)
- Filters out existing members
- Add button with loading spinner
- "Added" confirmation state with check icon
- Calls `addChannelMember()` API

---

## 9. Call Transcription System

### Database Migration

**File:** `backend/alembic/versions/20260315_0013_add_call_events_transcriptions.py`

Creates:
- `call_transcriptions` table (id, channel_id, call_initiator_id, call_type, duration, transcription_text, language, participants, status, timestamps)
- `messaging_chat_messages` table (id, channel_id, user_id, role, content, tool_calls, metadata, created_at)
- `message_type` column on `chat_channel_messages` (null = normal, "call_started", "call_ended", "call_missed")

### API Functions

| Function | Description |
|----------|-------------|
| `saveCallTranscription(channelId, data)` | Save a transcription with text, type, duration |
| `getChannelTranscriptions(channelId, limit)` | List transcriptions for a channel |
| `uploadCallRecording(channelId, audioBlob, callType, duration)` | Upload audio file for server-side transcription |

---

## 10. Database Migrations

| Migration | Description |
|-----------|-------------|
| `20260311_0012` | Add `custom_status` and `status_emoji` to `users` table |
| `20260315_0013` | Add `message_type` to messages, create `call_transcriptions` and `messaging_chat_messages` tables |

---

## 11. API Client Functions

**File:** `web/src/lib/api.ts` (modified)

### New Interfaces

- `CallTranscriptionItem` — transcription record shape
- `MessagingChatMessage` — chatbot message (role, content, tool_calls)
- `MessagingChatResponse` — chatbot response (response, tool_calls, message_id)
- `UserStatusPayload` — `{ custom_status, status_emoji }`

### New Functions

| Function | Method | Endpoint |
|----------|--------|----------|
| `getMyStatus()` | GET | `/api/messaging/status` |
| `updateMyStatus(data)` | PUT | `/api/messaging/status` |
| `saveCallTranscription(channelId, data)` | POST | `/api/messaging/channels/{id}/transcriptions/save` |
| `getChannelTranscriptions(channelId, limit)` | GET | `/api/messaging/channels/{id}/transcriptions` |
| `uploadCallRecording(channelId, blob, type, dur)` | POST | `/api/messaging/channels/{id}/transcriptions/upload` |
| `sendMessagingChatMessage(channelId, message)` | POST | `/api/messaging-chat/send` |
| `getMessagingChatHistory(channelId, limit)` | GET | `/api/messaging-chat/history/{id}` |
| `clearMessagingChatHistory(channelId)` | DELETE | `/api/messaging-chat/history/{id}` |

---

## 12. Test Coverage

**File:** `backend/tests/test_call_signaling.py` (new)

### Test Classes

| Class | Tests | Description |
|-------|-------|-------------|
| `TestMessagingConnectionManager` | 5 | Connection manager connect/disconnect, multi-tab, offline send, dead connection cleanup |
| `TestCallSignalingRouting` | 10 | Individual signal routing (initiate→incoming, accept→accepted, reject→rejected, hangup→ended, WebRTC relay) |
| `TestFullCallFlow` | 5 | Full audio call flow, rejection flow, video call type, offline target, hangup after disconnect |

**Total: 20 tests** covering the WebRTC call signaling infrastructure.
