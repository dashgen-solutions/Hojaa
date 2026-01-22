# Scope Canvas Module

## Overview

The Scope Canvas is a visual, client-friendly project management tool designed to bridge the gap between client expectations and development deliverables. It transforms vague scope documents into actionable, visual cards that both technical and non-technical stakeholders can understand and align on.

---

## Problem Statement

### The Pain Point

In AI product development (chatbots, agent architectures, automation):

1. **Clients describe requirements vaguely**: "Build us a great chatbot"
2. **Scope documents contain jargon**: Technical terms that don't translate to client expectations
3. **Development happens in Jira/ClickUp**: Tools too complex for clients to follow
4. **Misalignment discovered during demos**: 
   - Client: "Does it handle X?"
   - Team: "No, that wasn't in scope"
   - Client: "But we were hoping it would..."
5. **Root cause**: Client's mental model ≠ Development team's interpretation

### The Impact

- Scope creep during development
- Disappointed clients at demos
- Rework and timeline delays
- Trust erosion between client and team
- PM/Dev effort spent on tasks client didn't actually want

---

## Solution: Visual Scope Canvas

A canvas-based interface that:
1. **Extracts** functional deliverables from scope documents using AI
2. **Visualizes** them as simple, client-friendly cards
3. **Evolves** the scope through columns representing meetings/stages
4. **Aligns** client expectations with team deliverables in real-time
5. **Tracks** how scope changes over time with full audit trail

---

## User Personas

### 1. Project Manager (PM)
**Goals:**
- Ensure client and dev team are aligned
- Prevent scope creep
- Prepare effective demos
- Track what was promised vs delivered

**Pain Points:**
- Clients don't articulate needs clearly
- Scope changes mid-project without documentation
- Hard to communicate technical progress to non-technical clients

### 2. Developer
**Goals:**
- Build what client actually wants
- Avoid rework from misaligned expectations
- Focus on Jira tasks knowing they map to client needs

**Pain Points:**
- Jira tasks don't reflect client's language/priorities
- Build features client didn't actually need
- Scope changes interrupt sprint planning

### 3. Client (Non-Technical)
**Goals:**
- Understand what they're getting
- Ensure deliverables match their vision
- Provide feedback before it's too late

**Pain Points:**
- Can't navigate Jira/ClickUp
- Technical jargon in updates
- Discover gaps during demos, not before

---

## Core Features

### 1. Scope Document Upload & AI Extraction

**User Flow:**
1. PM creates new project in Canvas
2. PM uploads scope document (PDF, Word, etc.)
3. AI analyzes document and extracts "functional doables"
4. AI converts technical jargon → client-friendly language
5. Cards appear in Column 1 (Initial Extraction)

**Example Transformation:**
- **Scope Doc**: "Implement NLU pipeline with intent classification and entity extraction for customer queries"
- **Card**: "Chatbot understands what customers are asking and identifies key information (like order numbers)"

**AI Capabilities Needed:**
- Document parsing (PDF/Word/Text)
- NLP for requirement extraction
- Jargon simplification
- Functional decomposition

### 2. Visual Canvas (Left-to-Right Flow)

**Structure:**
```
[Column 1]        [Column 2]         [Column 3]           [Column 4]
Initial           MVP Selection      Meeting - Dec 15     Meeting - Dec 22
Extraction        
                                     
[Card: Feature A] → [Card: Feature A] → [Card: Feature A*]  → [Card: Feature A*]
[Card: Feature B]                       [NEW: Feature D]     [Card: Feature D]
[Card: Feature C] → [Card: Feature C] → [Card: Feature C]
```

**Column Types:**
- **Initial Extraction**: AI-generated cards from scope doc
- **MVP Selection**: Client/PM picks which cards go to MVP
- **Meeting Columns**: Each client meeting or major milestone

**Card Movement:**
- Cards flow from left to right as project progresses
- Cards can be added, modified, or removed in each column
- Visual diff shows what changed between columns

### 3. Card Structure

Each card contains:

**Front (Summary View):**
- Simple, client-facing title (e.g., "Chatbot answers FAQs")
- Status indicator (Not Started / In Progress / Done)
- Priority (Must Have / Nice to Have)
- Icon/color for quick scanning

**Back (Detail View - Click to expand):**
- **What**: Plain English description
- **Why**: Business value to client
- **Example**: Concrete example of the feature in action
- **Original Text**: Link to original scope document section
- **History**: Changes across columns
- **Comments**: Team and client can discuss
- **Linked Jira Tasks**: (Internal view only) Show related technical tasks

### 4. Meeting Notes Integration

**User Flow:**
1. PM has meeting with client
2. PM uploads meeting notes (Read.ai transcript, manual notes, etc.)
3. AI analyzes notes for:
   - New requirements mentioned
   - Changes to existing cards
   - Clarifications that affect scope
   - Decisions made (add/remove/modify features)
4. AI creates new column for this meeting
5. AI suggests:
   - Which cards to modify (shows diff)
   - New cards to add
   - Cards to remove/deprioritize
6. PM reviews AI suggestions, approves/edits
7. Client sees updated canvas with changes highlighted

**Example:**
- **Meeting Note**: "Client mentioned they want chatbot to handle product returns, not just inquiries"
- **AI Action**: 
  - Modifies existing card "Handle customer inquiries" → "Handle customer inquiries and returns"
  - Creates new card "Process return requests with order lookup"
  - Flags potential scope increase

### 5. Client-Friendly Language

**Principles:**
- No technical jargon (unless necessary and explained)
- Use concrete examples
- Focus on outcomes, not implementation
- Visual icons/colors for quick understanding

**Example Transformations:**
| Technical (Jira) | Client-Friendly (Canvas) |
|-----------------|--------------------------|
| "Implement RAG pipeline with Pinecone vector DB" | "Chatbot can search and answer from your company documents" |
| "Add OAuth 2.0 authentication flow" | "Users can securely log in with their company account" |
| "Deploy multi-turn conversation state management" | "Chatbot remembers context during a conversation" |
| "Implement fallback to human handoff" | "Chatbot transfers to support agent when needed" |

### 6. Change Tracking & History

**For Each Card:**
- Version history (what changed when)
- Visual diff (strikethrough old text, highlight new)
- Linked to meeting/column where change occurred
- Comment thread on why change was made

**For Entire Project:**
- Timeline view of scope evolution
- Scope drift metrics (cards added/removed/modified)
- Export snapshot at any point in time

### 7. Demo Preparation

**Pre-Demo Checklist:**
1. Filter canvas to show only "Must Have" cards
2. Highlight cards marked "Demo Ready"
3. Generate demo script:
   - "Show Feature A: [Description]"
   - "Expected client reaction: [...]"
   - "If client asks about X: [Response]"
4. Client expectation checklist:
   - [ ] Feature A will do X
   - [ ] Feature A will NOT do Y (out of scope)

**Post-Demo:**
- Record client feedback on each card
- Update cards based on demo learnings
- Create new column for post-demo state

---

## Technical Architecture

### Data Model

```
Project {
  id: string
  name: string
  client: string
  created_at: timestamp
  scope_document: File
  columns: Column[]
  cards: Card[]
}

Column {
  id: string
  project_id: string
  type: "initial_extraction" | "mvp_selection" | "meeting" | "custom"
  name: string
  order: number
  created_at: timestamp
  meeting_notes?: File
  ai_analysis?: string
}

Card {
  id: string
  project_id: string
  title: string (client-friendly)
  description: string
  business_value: string
  example: string
  priority: "must_have" | "nice_to_have" | "out_of_scope"
  status: "not_started" | "in_progress" | "done"
  history: CardVersion[]
  comments: Comment[]
  jira_links?: string[] (internal only)
  original_scope_text?: string
}

CardVersion {
  column_id: string
  changes: {
    field: string
    old_value: any
    new_value: any
  }[]
  timestamp: timestamp
  changed_by: string
}
```

### AI Components

#### 1. Scope Extraction AI
**Input**: Scope document (PDF/Word/Text)
**Output**: List of functional requirements as cards

**Capabilities:**
- Parse document structure (headings, lists, tables)
- Identify requirement statements vs background info
- Extract functional deliverables
- Detect dependencies between requirements
- Classify by priority (if mentioned)

**Technologies:**
- LLM (GPT-4, Claude) for understanding
- Prompt engineering for extraction
- Few-shot examples for consistency

#### 2. Jargon Simplification AI
**Input**: Technical requirement text
**Output**: Client-friendly description

**Capabilities:**
- Detect technical terms
- Generate plain English alternatives
- Maintain accuracy while simplifying
- Add examples for clarity

**Approach:**
- LLM with system prompt: "You are translating for a non-technical business client"
- Few-shot examples of good translations
- Validation: ensure no information loss

#### 3. Meeting Analysis AI
**Input**: Meeting transcript/notes
**Output**: Scope changes and new requirements

**Capabilities:**
- Detect mentions of existing features
- Identify new feature requests
- Spot scope changes ("actually, we need X to do Y too")
- Extract decisions made
- Flag potential scope creep

**Approach:**
- Named Entity Recognition for features
- Sentiment analysis for client satisfaction
- Change detection (compare to existing cards)
- Generate change summaries

#### 4. Card Matching AI
**Input**: Meeting discussion + Existing cards
**Output**: Which cards are affected

**Capabilities:**
- Semantic similarity between discussion and cards
- Understand synonyms ("refund" = "return")
- Detect impact (does this change affect multiple cards?)

---

## User Flows

### Flow 1: Project Kickoff

1. PM logs into MoMetric
2. Navigate to "Projects" module
3. Click "New Project"
4. Fill in: Project Name, Client, Team Members
5. Upload scope document
6. AI processes document (30-60 seconds)
7. Canvas appears with Column 1: "Initial Extraction"
8. 10-15 cards appear below scope document attachment
9. PM reviews cards, can:
   - Edit titles/descriptions
   - Merge similar cards
   - Delete irrelevant cards
   - Add missing cards manually
10. PM creates Column 2: "MVP Selection"
11. PM drags cards from Column 1 → Column 2 (only MVP items)
12. PM shares canvas link with client

### Flow 2: Client Reviews Canvas

1. Client receives link
2. Opens canvas (no login required for view-only, or optional login)
3. Sees visual board with cards
4. Clicks on cards to read details
5. Client leaves comments: "This is exactly what we need" or "Actually, we meant..."
6. PM gets notifications of client comments
7. PM updates cards based on feedback

### Flow 3: Weekly Meeting Update

1. PM has weekly client call
2. Read.ai records meeting
3. After meeting, PM uploads transcript to canvas
4. PM clicks "Add Meeting Column"
5. PM names column: "Meeting - Dec 15, 2024"
6. PM uploads meeting notes
7. AI analyzes notes (1-2 minutes)
8. AI creates new column and suggests:
   - Card A: Modified title and description (shows diff)
   - Card D: New card (client mentioned returns)
   - Card C: No changes
9. PM reviews suggestions:
   - Approves Card A modification
   - Edits Card D (AI didn't capture full context)
   - Approves Card C
10. Cards flow to new column with changes highlighted
11. PM tags client: "Please review updated scope based on our meeting"
12. Client approves or requests changes

### Flow 4: Demo Day

1. PM prepares for demo
2. PM clicks "Demo View" button
3. Canvas filters to show only "Must Have" + "Demo Ready" cards
4. PM generates checklist for demo
5. During demo:
   - PM shares screen showing canvas
   - For each card, shows built feature
   - Client sees direct mapping: Card → Feature
6. Client asks: "Can it handle X?"
7. PM checks canvas: "That's in Card D, which is scheduled for Sprint 3" or "That's not in current scope, we can add it"
8. After demo, PM updates card statuses to "Done"
9. PM creates "Post-Demo" column with client feedback

---

## Success Metrics

### For MVP (Internal Use)

**Alignment Metrics:**
- % of cards approved by client without changes
- Reduction in "surprise" requests during demos
- Client satisfaction scores post-demo

**Efficiency Metrics:**
- Time to align on scope (before vs after using canvas)
- Number of scope change requests (should stabilize after initial alignment)
- PM time spent on client communication

**Adoption Metrics:**
- % of projects using canvas
- Team NPS (would you recommend this tool?)
- Client engagement (views, comments on canvas)

### For Production (External Clients)

- Number of active projects
- Client retention (do they use it for multiple projects?)
- Reduction in project rework
- Time-to-alignment (initial scope → approved MVP)

---

## Differentiation from Existing Tools

### vs Jira/ClickUp
| Feature | Jira/ClickUp | Scope Canvas |
|---------|--------------|--------------|
| **Audience** | Technical teams | Clients + Teams |
| **Language** | Technical tasks, subtasks | Business outcomes |
| **Structure** | Hierarchical (epic→story→task) | Linear timeline (columns) |
| **Granularity** | Detailed execution | High-level features |
| **AI** | Limited | Scope extraction, change detection |
| **Client Access** | Complex, overwhelming | Simple, visual |
| **Purpose** | Execution tracking | Alignment & communication |

### vs Miro/Figma Boards
| Feature | Miro/Figma | Scope Canvas |
|---------|------------|--------------|
| **AI-Powered** | No | Yes (extraction, analysis) |
| **Structure** | Freeform canvas | Structured columns + cards |
| **Scope Tracking** | Manual | Automated change detection |
| **Integration** | Generic | Built for software scope management |
| **Version Control** | Basic | Full card history + diff |

### vs Traditional Scope Docs (Word/PDF)
| Feature | Traditional Docs | Scope Canvas |
|---------|-----------------|--------------|
| **Visibility** | Static, buried in email | Live, shared link |
| **Changes** | Track changes, confusing | Column-based evolution |
| **Client UX** | Read 30-page PDF | Visual, interactive cards |
| **Alignment Check** | Assumed after signature | Ongoing, explicit |
| **Demo Prep** | Manual extraction | Auto-generated checklist |

---

## Risks & Mitigations

### Risk 1: AI Extraction Accuracy
**Risk**: AI misinterprets scope document, extracts wrong features
**Mitigation**: 
- PM reviews all AI-generated cards before sharing with client
- Show original text alongside AI interpretation
- Allow manual editing of all cards
- Continuous improvement: learn from PM corrections

### Risk 2: Client Engagement
**Risk**: Clients don't use the canvas (too busy, prefer email)
**Mitigation**:
- Make view-only mode frictionless (no login)
- Send digestible summaries via email with link
- PM walks through canvas in first meeting
- Show quick wins ("This saved us 2 weeks of rework")

### Risk 3: Over-Simplification
**Risk**: Simplifying technical terms loses critical nuance
**Mitigation**:
- Keep original technical text available in card details
- Allow "technical mode" toggle for devs
- Maintain separate Jira tasks for execution detail
- This tool is for alignment, not execution

### Risk 4: Scope Creep Documentation
**Risk**: Making scope changes easy might encourage too many changes
**Mitigation**:
- Visualize cumulative scope change (scope drift metric)
- Alert PM when >X% cards added since initial
- Show timeline/budget impact of changes
- Require client approval for major changes

### Risk 5: Integration Overhead
**Risk**: Maintaining both Canvas and Jira becomes double work
**Mitigation**:
- Auto-link: Jira tasks can reference Canvas cards
- Canvas is client-facing (updated weekly/per meeting)
- Jira is internal (updated daily)
- Long-term: bidirectional sync (Canvas card status from Jira progress)

---

## Future Enhancements (Post-MVP)

1. **Acceptance Criteria Generation**: AI generates "what success looks like" for each card
2. **Dependency Mapping**: Show which cards depend on others
3. **Effort Estimation**: AI suggests complexity/hours per card
4. **Multi-Project View**: See scope patterns across all projects
5. **Template Library**: Pre-built canvases for "Chatbot Project", "Data Pipeline", etc.
6. **Integration with MoMetric Core**: Cards become "use cases" in KPI mapping module
7. **Client Portal**: Dedicated client login with all their projects
8. **Mobile App**: Client can review canvas on phone
9. **Slack/Teams Integration**: Notifications when canvas updates
10. **Video Demos on Cards**: Attach demo recordings to specific cards

---

## MVP Scope (Phase 1)

**Must Have:**
- [ ] Upload scope document
- [ ] AI extraction to cards
- [ ] Visual canvas with columns
- [ ] Drag-drop cards between columns
- [ ] Card detail view (title, description, status)
- [ ] Manual card creation/editing
- [ ] Share canvas link with client
- [ ] Export canvas as PDF

**Nice to Have (MVP):**
- [ ] Meeting notes upload
- [ ] AI meeting analysis (simplified version)
- [ ] Comment threads on cards
- [ ] Change history per card

**Post-MVP:**
- [ ] Jira integration
- [ ] Demo preparation tools
- [ ] Advanced AI suggestions
- [ ] Mobile responsive
- [ ] Multi-language (Arabic)

---

## Next Steps

1. **Validate with real project**: Use next AI chatbot project as test case
2. **Design UI mockups**: Canvas layout, card design
3. **Build AI prototype**: Test scope extraction on past scope documents
4. **Define tech stack**: Frontend (React?), Backend (Python?), AI (OpenAI API?)
5. **Set success criteria**: What would make MVP successful for internal use?



