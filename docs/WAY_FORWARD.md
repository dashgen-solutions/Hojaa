# MoMetric: Way Forward

**Version:** 1.0
**Date:** January 28, 2026
**Status:** Strategic Planning Document

---

## Executive Summary

MoMetric is evolving from a **requirements discovery tool** into a **scope lifecycle management platform**. The core insight: projects fail not because requirements weren't gathered, but because scope changes happen invisibly, meeting notes scatter across tools, and there's no single source of truth connecting what was agreed → what changed → what's being built.

**The Vision:** One living knowledge graph that serves as the project's single source of truth — from first discovery conversation through final delivery.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Problem Statement](#2-problem-statement)
3. [Target Vision](#3-target-vision)
4. [Architecture Evolution](#4-architecture-evolution)
5. [Implementation Approach](#5-implementation-approach)
6. [Phase-wise Roadmap](#6-phase-wise-roadmap)
7. [Technical Specifications](#7-technical-specifications)
8. [Success Metrics](#8-success-metrics)
9. [Risks & Mitigations](#9-risks--mitigations)
10. [Open Decisions](#10-open-decisions)

---

## 1. Current State Analysis

### 1.1 What We Have (Functional)

| Component | Status | Description |
|-----------|--------|-------------|
| **Discovery Conversation** | ✅ Complete | Business + Consultant chat to extract requirements |
| **Document Upload** | ✅ Complete | PDF, DOCX, TXT parsing and text extraction |
| **AI Question Generation** | ✅ Complete | 10 contextual questions based on user type (technical/non-technical) |
| **Knowledge Graph Building** | ✅ Complete | Hierarchical tree from answered questions |
| **Feature Exploration Chat** | ✅ Complete | Per-node deep-dive conversations |
| **Node Management** | ✅ Complete | Add, edit, delete, move nodes |
| **Session Management** | ✅ Complete | Create, save, load, list sessions |
| **User Authentication** | ✅ Complete | Register, login, JWT tokens |
| **Responsive UI** | ✅ Complete | Clean interface inspired by Specifai |

### 1.2 Tech Stack

```
Frontend:  Next.js 14 + TypeScript + Tailwind CSS + Zustand
Backend:   FastAPI + Python 3.11 + Pydantic AI
Database:  PostgreSQL 14+
AI:        OpenAI GPT-4 / Anthropic Claude (configurable)
Infra:     Docker + Docker Compose
```

### 1.3 Current Data Model

```
User (1) ──── (many) Session
                      │
                      ├──── (many) Question (initial 10 questions)
                      │
                      ├──── (many) Node (hierarchical tree)
                      │              │
                      │              └──── (many) Conversation
                      │                            │
                      │                            └──── (many) Message
```

### 1.4 What's Missing for the Vision

| Gap | Impact |
|-----|--------|
| No meeting notes ingestion | Scope changes from meetings are lost |
| No graph versioning | Can't see "what was scope at week 2" |
| No visual state management | Can't distinguish active vs deferred scope |
| No audit trail | No accountability for changes |
| No planning integration | Graph doesn't connect to actual work |
| No PDF export | Can't generate formal scope documents |
| No change attribution | Don't know who changed what and why |

---

## 2. Problem Statement

### 2.1 The Real-World Pain

```
Day 1:   Scope agreed in discovery session
Week 2:  Client mentions "small addition" in meeting
Week 4:  Team builds original scope + verbal additions
Week 6:  Client: "This isn't what I asked for"
Week 8:  Project over budget, everyone unhappy
```

**Root Causes:**
1. Meeting notes exist but scattered (Otter, Fireflies, emails, Slack)
2. Verbal scope changes aren't formalized
3. No single place showing: original scope + all changes + who approved
4. Teams work on things without knowing if it's in scope
5. Out-of-scope work is either lost or causes friction

### 2.2 Who Feels the Pain

| Persona | Pain |
|---------|------|
| **Business/Client** | "I said this in the meeting, why wasn't it built?" |
| **Consultant/BA** | "I can't track all the changes across 10 meetings" |
| **Project Manager** | "I don't know what's actually in scope anymore" |
| **Developer** | "I built what was asked, now they say it's wrong" |
| **Agency Owner** | "Projects overrun, clients unhappy, team burned out" |

---

## 3. Target Vision

### 3.1 The Living Knowledge Graph

The knowledge graph becomes the **single source of truth** for the entire project lifecycle:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        THE LIVING KNOWLEDGE GRAPH                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐                    ┌──────────────────────────┐   │
│  │     INPUTS       │                    │     GRAPH STATES         │   │
│  │                  │                    │                          │   │
│  │ • Discovery chat │                    │  ● Active (in scope)     │   │
│  │ • Documents      │ ─────────────────► │  ○ Deferred (greyed)     │   │
│  │ • Meeting notes  │                    │  ★ Newly added           │   │
│  │ • Manual edits   │                    │  △ Modified              │   │
│  │                  │                    │  ✓ Completed             │   │
│  └──────────────────┘                    │                          │   │
│                                          │  Each node tracks:       │   │
│  ┌──────────────────┐                    │  • Source (where from)   │   │
│  │    OUTPUTS       │                    │  • History (all changes) │   │
│  │                  │                    │  • Assignment (who)      │   │
│  │ • PDF export     │ ◄───────────────── │  • Status (progress)     │   │
│  │ • Planning cards │                    │                          │   │
│  │ • Audit trail    │                    └──────────────────────────┘   │
│  │ • Change log     │                                                   │
│  └──────────────────┘                                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Core Principles

1. **Graph is Truth** — No separate documents. The graph IS the scope.
2. **Nothing is Deleted** — Items are deferred/greyed, never removed. History preserved.
3. **Everything Attributed** — Every change knows: who, when, from where (which meeting/doc).
4. **Simple by Default** — 90% of users need simple. Complexity available but not required.
5. **Inputs are Easy** — Paste meeting notes, upload doc, type manually. AI figures out the rest.

### 3.3 User Journey (Future State)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER JOURNEY                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 1: DISCOVERY (existing)                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Business + Consultant sit together                                │   │
│  │ → Upload initial doc / describe project                           │   │
│  │ → Answer 10 AI-generated questions                                │   │
│  │ → Explore features via chat                                       │   │
│  │ → Result: Initial knowledge graph                                 │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│                                    ▼                                     │
│  PHASE 2: ONGOING EVOLUTION (new)                                       │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Week 2: Meeting happens                                           │   │
│  │ → User clicks "Add Meeting Notes"                                 │   │
│  │ → Pastes transcript from any note-taker                           │   │
│  │ → AI suggests: "Looks like 2 scope changes detected"              │   │
│  │    • Add "Dark mode" under UI Features                            │   │
│  │    • Defer "Mobile app" to Phase 2                                │   │
│  │ → User approves/rejects each suggestion                           │   │
│  │ → Graph updates with full attribution                             │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│                                    ▼                                     │
│  PHASE 3: PLANNING & EXECUTION (new)                                    │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ → Switch to Planning view                                         │   │
│  │ → See cards derived from graph nodes                              │   │
│  │ → Assign team members to features                                 │   │
│  │ → Track: Todo → In Progress → Done                                │   │
│  │ → Work marked complete updates graph                              │   │
│  │ → Out-of-scope work flagged but captured                          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│                                    ▼                                     │
│  PHASE 4: ACCOUNTABILITY (new)                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ → "Why is this feature here?" → Click → See source meeting        │   │
│  │ → "What changed since kickoff?" → View change timeline            │   │
│  │ → "Generate scope document" → Export PDF with current state       │   │
│  │ → "What's out of scope?" → See deferred items with reasons        │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Architecture Evolution

### 4.1 Current Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Next.js   │────▶│   FastAPI   │────▶│  PostgreSQL │
│   Frontend  │◀────│   Backend   │◀────│   Database  │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  OpenAI /   │
                    │  Anthropic  │
                    └─────────────┘
```

### 4.2 Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Discovery  │  │   Graph     │  │  Planning   │  │   Audit     │    │
│  │    View     │  │    View     │  │    Board    │  │   Trail     │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                         API LAYER                                │    │
│  │  /discovery  /graph  /ingest  /planning  /export  /audit        │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                       SERVICE LAYER                              │    │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐       │    │
│  │  │ Discovery │ │  Ingest   │ │  Graph    │ │  Export   │       │    │
│  │  │  Service  │ │  Service  │ │  Service  │ │  Service  │       │    │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘       │    │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐                      │    │
│  │  │ Planning  │ │  Audit    │ │    AI     │                      │    │
│  │  │  Service  │ │  Service  │ │  Service  │                      │    │
│  │  └───────────┘ └───────────┘ └───────────┘                      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                             DATA LAYER                                   │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                        PostgreSQL                                │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │    │
│  │  │  Users  │ │ Sessions│ │  Nodes  │ │ History │ │ Sources │   │    │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐                           │    │
│  │  │ Assigns │ │  Cards  │ │  Audit  │                           │    │
│  │  └─────────┘ └─────────┘ └─────────┘                           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Data Model Evolution

#### New Tables Required

```sql
-- Source tracking (where did this come from?)
CREATE TABLE sources (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES sessions(id),
    source_type VARCHAR(50),  -- 'discovery', 'meeting', 'document', 'manual'
    source_name VARCHAR(255), -- 'Kickoff Meeting Jan 15', 'requirements.pdf'
    raw_content TEXT,         -- Original content
    processed_at TIMESTAMP,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Node history (what changed?)
CREATE TABLE node_history (
    id UUID PRIMARY KEY,
    node_id UUID REFERENCES nodes(id),
    change_type VARCHAR(50),  -- 'created', 'modified', 'status_changed', 'moved'
    field_changed VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    source_id UUID REFERENCES sources(id),
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP DEFAULT NOW()
);

-- Assignments (who's working on what?)
CREATE TABLE assignments (
    id UUID PRIMARY KEY,
    node_id UUID REFERENCES nodes(id),
    user_id UUID REFERENCES users(id),
    role VARCHAR(50),         -- 'owner', 'assignee', 'reviewer'
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMP DEFAULT NOW()
);

-- Planning cards (lightweight task tracking)
CREATE TABLE cards (
    id UUID PRIMARY KEY,
    node_id UUID REFERENCES nodes(id),
    session_id UUID REFERENCES sessions(id),
    status VARCHAR(50),       -- 'todo', 'in_progress', 'review', 'done'
    priority VARCHAR(20),     -- 'low', 'medium', 'high'
    due_date DATE,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Team members (for assignment dropdown)
CREATE TABLE team_members (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES sessions(id),
    name VARCHAR(255),
    email VARCHAR(255),
    role VARCHAR(100),        -- 'developer', 'designer', 'pm', etc.
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Modified Tables

```sql
-- nodes table additions
ALTER TABLE nodes ADD COLUMN status VARCHAR(50) DEFAULT 'active';
-- 'active', 'deferred', 'completed', 'removed'

ALTER TABLE nodes ADD COLUMN source_id UUID REFERENCES sources(id);
-- Where did this node originally come from?

ALTER TABLE nodes ADD COLUMN acceptance_criteria JSONB;
-- Array of acceptance criteria items

ALTER TABLE nodes ADD COLUMN priority VARCHAR(20);
-- 'low', 'medium', 'high', 'critical'
```

---

## 5. Implementation Approach

### 5.1 Guiding Principles

1. **Incremental Delivery** — Each phase delivers user value independently
2. **Backward Compatible** — Existing sessions continue to work
3. **Database First** — Schema changes deployed before features
4. **AI-Assisted, Human-Approved** — AI suggests, users decide
5. **Simple First** — Launch simple, add complexity based on feedback

### 5.2 Development Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DEVELOPMENT APPROACH                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  For each feature:                                                       │
│                                                                          │
│  1. DATABASE SCHEMA                                                      │
│     └─ Create migration                                                  │
│     └─ Add models                                                        │
│     └─ Verify backward compatibility                                     │
│                                                                          │
│  2. BACKEND API                                                          │
│     └─ Add Pydantic schemas                                              │
│     └─ Create service layer                                              │
│     └─ Add API endpoints                                                 │
│     └─ Write tests                                                       │
│                                                                          │
│  3. AI INTEGRATION (if needed)                                           │
│     └─ Design prompts                                                    │
│     └─ Create Pydantic AI agents                                         │
│     └─ Test with sample data                                             │
│                                                                          │
│  4. FRONTEND UI                                                          │
│     └─ Create components                                                 │
│     └─ Integrate with API                                                │
│     └─ Add to navigation                                                 │
│                                                                          │
│  5. INTEGRATION TEST                                                     │
│     └─ End-to-end flow                                                   │
│     └─ Edge cases                                                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Phase-wise Roadmap

### Phase 1: Meeting Notes Integration
**Goal:** Close the biggest gap — scattered meeting notes

#### 1.1 Features
- [ ] "Add Source" button in UI (meeting notes, document, manual note)
- [ ] Text input modal for pasting meeting transcripts
- [ ] AI parses meeting notes and extracts:
  - Scope additions (new features/requirements)
  - Scope modifications (changes to existing items)
  - Scope deferrals (items pushed to later phase)
  - Action items (tasks mentioned)
- [ ] AI presents suggestions with confidence scores
- [ ] User approves/rejects/edits each suggestion
- [ ] Approved changes applied to graph with source attribution
- [ ] Source stored for future reference

#### 1.2 Database Changes
- [ ] Create `sources` table
- [ ] Add `source_id` to `nodes` table
- [ ] Create migration scripts

#### 1.3 API Endpoints
```
POST /api/sources/ingest           # Submit meeting notes/document
GET  /api/sources/{session_id}     # List all sources for session
GET  /api/sources/detail/{id}      # Get source with extracted suggestions
POST /api/sources/apply            # Apply approved suggestions to graph
```

#### 1.4 AI Agent Design
```python
class MeetingNotesAgent:
    """
    Analyzes meeting notes and extracts scope-relevant information.

    Input: Raw meeting transcript + current graph state
    Output: List of suggested changes with:
        - change_type: 'add' | 'modify' | 'defer' | 'action_item'
        - target_node: existing node ID (for modify/defer) or parent (for add)
        - content: what to add/change
        - confidence: 0-1 score
        - reasoning: why AI thinks this is a scope change
    """
```

#### 1.5 UI Components
- [ ] `AddSourceButton` — Opens modal to add new source
- [ ] `SourceInputModal` — Text area for pasting notes + metadata (meeting name, date)
- [ ] `SuggestionReviewPanel` — Shows AI suggestions with approve/reject/edit
- [ ] `SourceBadge` — Shows on nodes indicating their source

---

### Phase 2: Graph State Management
**Goal:** Make scope changes visible and manageable

#### 2.1 Features
- [ ] Node status: Active (solid), Deferred (grey), Completed (green check)
- [ ] Status change with reason capture
- [ ] Visual differentiation in graph view
- [ ] Filter graph by status (show all, active only, deferred only)
- [ ] "Recently changed" highlighting (nodes changed in last 7 days)
- [ ] Bulk status operations (defer entire branch)

#### 2.2 Database Changes
- [ ] Add `status` column to `nodes`
- [ ] Create `node_history` table
- [ ] Add triggers for automatic history logging

#### 2.3 API Endpoints
```
PATCH /api/nodes/{id}/status       # Change node status
GET   /api/nodes/{session_id}/filter?status=active
GET   /api/nodes/{id}/history      # Get change history for node
```

#### 2.4 UI Components
- [ ] `NodeStatusIndicator` — Visual badge showing status
- [ ] `StatusChangeModal` — Change status with reason
- [ ] `GraphFilterBar` — Filter nodes by status
- [ ] `RecentChangesHighlight` — Subtle animation/border for recent changes

---

### Phase 3: Audit Trail & History
**Goal:** Full accountability — who changed what, when, why

#### 3.1 Features
- [ ] Every change logged automatically
- [ ] Click any node → See full history
- [ ] Timeline view: "What changed this week?"
- [ ] Filter by: date range, user, change type
- [ ] Link changes back to source (which meeting caused this)
- [ ] Change comparison: "Show me what's different from Week 1"

#### 3.2 Database Changes
- [ ] Ensure `node_history` captures all fields
- [ ] Add indexes for efficient querying
- [ ] Add `changed_by` tracking

#### 3.3 API Endpoints
```
GET /api/audit/{session_id}                    # Full audit log
GET /api/audit/{session_id}/timeline           # Timeline view
GET /api/audit/{session_id}/compare?from=date  # Compare snapshots
GET /api/nodes/{id}/history                    # Single node history
```

#### 3.4 UI Components
- [ ] `NodeHistoryPanel` — Slide-out showing node's full history
- [ ] `AuditTimeline` — Chronological view of all changes
- [ ] `ChangeComparison` — Side-by-side or diff view
- [ ] `SourceLink` — Clickable link to original source

---

### Phase 4: Lightweight Planning Board
**Goal:** Connect scope to actual work

#### 4.1 Features
- [ ] "Planning" view — Kanban-style board
- [ ] Cards auto-generated from graph nodes (configurable which levels)
- [ ] Columns: Backlog → Todo → In Progress → Review → Done
- [ ] Drag-and-drop between columns
- [ ] Assign team members to cards
- [ ] Card status syncs back to graph node
- [ ] Simple due dates (optional)
- [ ] Priority flags

#### 4.2 Database Changes
- [ ] Create `cards` table
- [ ] Create `team_members` table
- [ ] Create `assignments` table

#### 4.3 API Endpoints
```
GET    /api/planning/{session_id}              # Get board with cards
POST   /api/planning/cards                     # Create card from node
PATCH  /api/planning/cards/{id}                # Update card status
POST   /api/planning/cards/{id}/assign         # Assign team member
GET    /api/planning/team/{session_id}         # Get team members
POST   /api/planning/team                      # Add team member
```

#### 4.4 UI Components
- [ ] `PlanningBoard` — Main Kanban view
- [ ] `PlanningCard` — Individual card component
- [ ] `TeamMemberSelector` — Dropdown for assignment
- [ ] `CardDetailModal` — Expanded view with details
- [ ] `BoardColumnHeader` — Column with count and actions

---

### Phase 5: Export & Documentation
**Goal:** Generate formal deliverables when needed

#### 5.1 Features
- [ ] Export to PDF — Formatted scope document
- [ ] Export options:
  - Full scope (all active items)
  - Scope + deferred (with clear separation)
  - Change log (what changed since date X)
  - Planning status (what's done, what's pending)
- [ ] Customizable PDF template
- [ ] Export to JSON (for integrations)
- [ ] Export to Markdown

#### 5.2 API Endpoints
```
POST /api/export/pdf                # Generate PDF
POST /api/export/json               # Generate JSON
POST /api/export/markdown           # Generate Markdown
GET  /api/export/templates          # Available templates
```

#### 5.3 Libraries
- Python: `reportlab` or `weasyprint` for PDF generation
- Consider: HTML → PDF approach for easier templating

#### 5.4 PDF Structure
```
┌─────────────────────────────────────────────┐
│           PROJECT SCOPE DOCUMENT            │
│           [Project Name]                    │
│           Generated: [Date]                 │
├─────────────────────────────────────────────┤
│                                             │
│  1. EXECUTIVE SUMMARY                       │
│     Brief project description               │
│                                             │
│  2. SCOPE ITEMS                             │
│     2.1 Feature A                           │
│         • Requirement 1                     │
│         • Requirement 2                     │
│         Acceptance Criteria:                │
│         [ ] Criterion 1                     │
│         [ ] Criterion 2                     │
│                                             │
│  3. DEFERRED ITEMS (if included)            │
│     • Item X (deferred in Meeting Y)        │
│                                             │
│  4. CHANGE LOG (if included)                │
│     • Jan 15: Added Feature B (Meeting X)   │
│     • Jan 22: Deferred Feature C            │
│                                             │
│  5. TEAM & ASSIGNMENTS                      │
│     Feature A: John (Owner)                 │
│                                             │
└─────────────────────────────────────────────┘
```

---

### Phase 6: Polish & Enhancement
**Goal:** Refinement based on real usage

#### 6.1 Potential Features
- [ ] Acceptance criteria as checklist per node
- [ ] Comments/discussion on nodes
- [ ] Notifications (email/in-app) for scope changes
- [ ] Role-based permissions (who can approve changes)
- [ ] Templates for common project types
- [ ] Graph snapshot/versioning ("Save as Version 1.0")
- [ ] Integrations (Slack notifications, calendar for meetings)
- [ ] Mobile-responsive planning board

---

## 7. Technical Specifications

### 7.1 AI Agent Specifications

#### Meeting Notes Parser Agent
```python
from pydantic import BaseModel
from pydantic_ai import Agent

class ScopeChange(BaseModel):
    change_type: Literal['add', 'modify', 'defer', 'remove']
    target_node_id: Optional[str]  # For modify/defer
    parent_node_id: Optional[str]  # For add
    title: str
    description: Optional[str]
    acceptance_criteria: Optional[List[str]]
    confidence: float  # 0-1
    reasoning: str
    source_quote: str  # The exact quote from meeting notes

class MeetingNotesOutput(BaseModel):
    summary: str
    scope_changes: List[ScopeChange]
    action_items: List[str]
    questions_raised: List[str]  # Things that need clarification

meeting_notes_agent = Agent(
    model="openai:gpt-4o",
    output_type=MeetingNotesOutput,
    system_prompt="""
    You are a scope analyst. Given meeting notes and the current project scope graph,
    identify any scope changes discussed in the meeting.

    Be conservative - only flag clear scope changes, not general discussion.
    Include the exact quote from the meeting that supports each change.
    """
)
```

#### Graph Diff Agent (for comparisons)
```python
class GraphDiff(BaseModel):
    added_nodes: List[NodeSummary]
    modified_nodes: List[ModifiedNode]
    deferred_nodes: List[NodeSummary]
    removed_nodes: List[NodeSummary]
    summary: str

graph_diff_agent = Agent(
    model="openai:gpt-4o-mini",  # Lighter model for comparison
    output_type=GraphDiff,
    system_prompt="""
    Compare two versions of a project scope graph.
    Identify what was added, modified, deferred, or removed.
    Provide a human-readable summary.
    """
)
```

### 7.2 Frontend State Management

```typescript
// Zustand store structure for new features
interface MoMetricStore {
  // Existing
  session: Session | null;
  nodes: Node[];

  // New: Sources
  sources: Source[];
  pendingSuggestions: ScopeSuggestion[];

  // New: Planning
  cards: Card[];
  teamMembers: TeamMember[];
  boardColumns: BoardColumn[];

  // New: Audit
  auditLog: AuditEntry[];
  nodeHistory: Record<string, HistoryEntry[]>;

  // Actions
  addSource: (source: SourceInput) => Promise<void>;
  applySuggestion: (suggestion: ScopeSuggestion) => Promise<void>;
  updateNodeStatus: (nodeId: string, status: NodeStatus, reason: string) => Promise<void>;
  moveCard: (cardId: string, newStatus: CardStatus) => Promise<void>;
  assignCard: (cardId: string, userId: string) => Promise<void>;
}
```

### 7.3 API Response Standards

```typescript
// Standard response wrapper
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    total?: number;
    page?: number;
    timestamp: string;
  };
}

// Pagination
interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
}
```

---

## 8. Success Metrics

### 8.1 Product Metrics

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| Session completion rate | Unknown | >70% | Sessions reaching tree_generated status |
| Meeting notes added per session | 0 | >3 | Average sources added per active session |
| Scope changes tracked | 0 | >5 | Average changes captured from meetings |
| Planning cards created | 0 | >10 | Cards created per session |
| Time to first export | N/A | <2 weeks | Time from session start to first PDF |

### 8.2 User Satisfaction Indicators

- Users can answer: "What's in scope?" immediately
- Users can answer: "Why is this feature here?" with one click
- Users can answer: "What changed since kickoff?" easily
- Projects report fewer scope disputes
- Teams feel aligned on what to build

### 8.3 Technical Metrics

| Metric | Target |
|--------|--------|
| API response time (p95) | <500ms |
| AI processing time (meeting notes) | <10s |
| PDF generation time | <5s |
| Test coverage | >80% |
| Uptime | 99.5% |

---

## 9. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| AI misinterprets meeting notes | High | Medium | Always require human approval; show confidence scores |
| Graph becomes too complex | Medium | Medium | Add collapsing, filtering; limit depth recommendations |
| Users don't add meeting notes | High | Medium | Make it dead simple; show value immediately |
| Performance degrades with large graphs | Medium | Low | Pagination, lazy loading, database indexing |
| LLM costs spike | Medium | Medium | Use cheaper models for simple tasks; cache responses |
| Scope of MoMetric itself creeps | High | High | Stick to phases; get user feedback before expanding |

---

## 10. Open Decisions

### Needs Decision

| Question | Options | Recommendation |
|----------|---------|----------------|
| **AI assistance level for meeting notes** | A) Auto-suggest changes (user approves) <br> B) Just attach notes (manual edits) <br> C) Both available | **A) Auto-suggest** — This is the key value prop |
| **Acceptance criteria location** | A) Child nodes <br> B) Checklist on node <br> C) Separate section | **B) Checklist on node** — Simpler, keeps graph clean |
| **Assignment granularity** | A) Feature level only <br> B) Any node <br> C) Both | **C) Both** — Features have owners, sub-items have assignees |
| **Change approval workflow** | A) Anyone can approve <br> B) Role-based <br> C) Configurable | **C) Configurable** — Start simple, add roles later |
| **Progress on graph vs planning board** | A) Graph shows progress <br> B) Planning only <br> C) Both | **C) Both** — Sync status between them |

### Parking Lot (Future Consideration)

- Real-time collaboration (multiple users editing)
- External integrations (Jira, Slack, Calendar)
- Version snapshots ("Save as v1.0")
- Role-based access control
- White-labeling for agencies
- API access for third-party tools

---

## Appendix A: File Structure (Target)

```
mometric/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── auth.py
│   │   │       ├── sessions.py
│   │   │       ├── upload.py
│   │   │       ├── questions.py
│   │   │       ├── chat.py
│   │   │       ├── tree.py
│   │   │       ├── sources.py          # NEW
│   │   │       ├── planning.py         # NEW
│   │   │       ├── audit.py            # NEW
│   │   │       └── export.py           # NEW
│   │   ├── services/
│   │   │   ├── document_analyzer.py
│   │   │   ├── question_generator.py
│   │   │   ├── tree_builder.py
│   │   │   ├── conversation_flow.py
│   │   │   ├── meeting_notes_parser.py # NEW
│   │   │   ├── graph_service.py        # NEW
│   │   │   ├── planning_service.py     # NEW
│   │   │   ├── audit_service.py        # NEW
│   │   │   └── export_service.py       # NEW
│   │   └── models/
│   │       ├── database.py             # Extended
│   │       ├── schemas.py              # Extended
│   │       └── agent_models.py         # Extended
│   └── migrations/
│       └── versions/                   # Alembic migrations
│
├── requirements-discovery-ui/
│   └── src/
│       ├── app/
│       │   ├── page.tsx
│       │   ├── planning/
│       │   │   └── page.tsx            # NEW
│       │   └── audit/
│       │       └── page.tsx            # NEW
│       ├── components/
│       │   ├── sources/                # NEW
│       │   │   ├── AddSourceButton.tsx
│       │   │   ├── SourceInputModal.tsx
│       │   │   └── SuggestionReview.tsx
│       │   ├── planning/               # NEW
│       │   │   ├── PlanningBoard.tsx
│       │   │   ├── PlanningCard.tsx
│       │   │   └── TeamSelector.tsx
│       │   ├── audit/                  # NEW
│       │   │   ├── AuditTimeline.tsx
│       │   │   └── NodeHistory.tsx
│       │   └── export/                 # NEW
│       │       └── ExportModal.tsx
│       └── stores/
│           └── useStore.ts             # Extended
│
└── DOCS/
    ├── WAY_FORWARD.md                  # This document
    ├── API_SPEC.md                     # Detailed API specs
    └── ARCHITECTURE.md                 # Architecture decisions
```

---

## Appendix B: Quick Reference

### API Endpoints Summary (All Phases)

```
# Existing
POST   /api/auth/register
POST   /api/auth/login
POST   /api/sessions
GET    /api/sessions
POST   /api/upload/{session_id}
GET    /api/questions/{session_id}
POST   /api/questions/submit
GET    /api/tree/{session_id}
POST   /api/chat/start
POST   /api/chat/message

# Phase 1: Sources
POST   /api/sources/ingest
GET    /api/sources/{session_id}
POST   /api/sources/apply

# Phase 2: Status
PATCH  /api/nodes/{id}/status
GET    /api/nodes/{session_id}/filter

# Phase 3: Audit
GET    /api/audit/{session_id}
GET    /api/audit/{session_id}/timeline
GET    /api/nodes/{id}/history

# Phase 4: Planning
GET    /api/planning/{session_id}
POST   /api/planning/cards
PATCH  /api/planning/cards/{id}
POST   /api/planning/cards/{id}/assign
POST   /api/planning/team

# Phase 5: Export
POST   /api/export/pdf
POST   /api/export/json
POST   /api/export/markdown
```

---

*Document End*
