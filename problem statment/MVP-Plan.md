# MVP Plan - Scope Canvas Module

## Overview

This document outlines the Minimum Viable Product (MVP) for the Scope Canvas module of MoMetric. The MVP will be used internally on our AI projects to validate the concept before offering to external customers.

---

## MVP Goal

**Validate that visual, AI-powered scope clarity reduces misalignment between our team and clients.**

### Success Criteria
1. **Measurable alignment improvement**: Reduce "surprise" scope requests during demos by 50%
2. **Team adoption**: Used on 100% of new AI projects within 3 months
3. **Client satisfaction**: Average client feedback score of 8/10 or higher
4. **Time savings**: Reduce time spent on scope clarification by 30%
5. **Team NPS**: Internal team rates it 7+ (would recommend to others)

---

## MVP Scope (What We're Building)

### Phase 1: Core Canvas (Weeks 1-4)

#### 1. Project Creation & Setup
**User Story**: As a PM, I want to create a new project and upload a scope document.

**Features:**
- [ ] Simple project creation form (name, client, team members)
- [ ] Upload scope document (PDF, Word, .txt)
- [ ] Store document securely
- [ ] Basic project dashboard (list of all projects)

**Acceptance Criteria:**
- Can create project in < 30 seconds
- Supports PDF, .docx, .txt files up to 10MB
- Each project has unique shareable link

#### 2. AI Scope Extraction
**User Story**: As a PM, I want AI to extract deliverables from my scope document so I don't have to type them manually.

**Features:**
- [ ] Parse uploaded document
- [ ] Use LLM (GPT-4 or Claude) to extract functional requirements
- [ ] Convert technical jargon to client-friendly language
- [ ] Generate 5-15 cards per document
- [ ] Display cards in Column 1 "Initial Extraction"

**Acceptance Criteria:**
- Extracts cards within 60 seconds for typical scope doc (5-10 pages)
- At least 70% of extracted cards are relevant (based on PM review)
- Cards are in plain English (no technical jargon)
- Can handle both structured (bullets) and unstructured (paragraph) docs

**Technical Approach:**
```python
# Pseudo-code for AI extraction
def extract_scope_cards(document_text):
    prompt = """
    Extract functional deliverables from this scope document.
    For each deliverable:
    1. Write a clear, client-friendly title (max 8 words)
    2. Describe what it means in plain English (2-3 sentences)
    3. Explain why it matters to the business (1 sentence)
    
    Convert any technical jargon to layman terms.
    Focus on WHAT the system will do, not HOW it's built.
    
    Scope document:
    {document_text}
    
    Return as JSON array of cards.
    """
    
    response = llm.generate(prompt)
    cards = parse_json(response)
    return cards
```

#### 3. Visual Canvas UI
**User Story**: As a PM or client, I want to see deliverables as visual cards I can click and explore.

**Features:**
- [ ] Canvas layout (horizontal columns)
- [ ] Column 1: "Initial Extraction" (auto-created)
- [ ] Cards displayed as visual boxes with:
  - Title
  - Short description (truncated)
  - Status indicator (not started/in progress/done)
  - Click to expand
- [ ] Drag-and-drop cards between columns
- [ ] Zoom and pan canvas
- [ ] Mobile-responsive (basic viewing)

**Acceptance Criteria:**
- Canvas loads in < 2 seconds
- Can drag-drop cards smoothly
- Works on desktop (Chrome, Safari, Edge)
- Mobile can view but not edit (for MVP)

**UI Sketch:**
```
┌─────────────────────────────────────────────────────────┐
│  Project: Customer Support Chatbot                       │
│  Client: Acme Corp                                       │
└─────────────────────────────────────────────────────────┘

[Column 1: Initial Extraction]    [Column 2: MVP Selection]

┌──────────────────────┐
│ 📄 Scope Doc         │
│ chatbot-scope.pdf    │
└──────────────────────┘
         ↓
┌──────────────────────┐         ┌──────────────────────┐
│ Chatbot answers FAQs │   -->   │ Chatbot answers FAQs │
│ ⚪ Not Started       │         │ 🟢 In Progress       │
└──────────────────────┘         └──────────────────────┘

┌──────────────────────┐
│ Handle returns       │
│ ⚪ Not Started       │
└──────────────────────┘

┌──────────────────────┐
│ Escalate to human    │
│ ⚪ Not Started       │
└──────────────────────┘
```

#### 4. Card Detail View
**User Story**: As a PM or client, I want to click a card and see full details.

**Features:**
- [ ] Modal or side panel on card click
- [ ] Display:
  - Title (editable)
  - Full description (editable)
  - Business value / why it matters
  - Status dropdown
  - Comments section
  - Link to original scope doc section (optional for MVP)
- [ ] Save changes

**Acceptance Criteria:**
- Modal opens in < 500ms
- All fields editable by PM
- Auto-saves on change
- Comment timestamp and author displayed

#### 5. Manual Card Management
**User Story**: As a PM, I want to add, edit, or delete cards that AI missed or got wrong.

**Features:**
- [ ] "Add Card" button in any column
- [ ] Create card manually (title, description, status)
- [ ] Edit any AI-generated card
- [ ] Delete cards (with confirmation)
- [ ] Merge duplicate cards (drag one onto another)

**Acceptance Criteria:**
- Can create card in < 10 seconds
- Edits save immediately
- Delete requires confirmation
- Merge combines descriptions

### Phase 2: Collaboration (Weeks 5-6)

#### 6. Column Management
**User Story**: As a PM, I want to create columns for different project stages (MVP selection, meetings, etc.).

**Features:**
- [ ] "Add Column" button
- [ ] Name column (e.g., "MVP Selection", "Dec 15 Meeting")
- [ ] Reorder columns (drag-drop)
- [ ] Delete empty columns
- [ ] Attach meeting notes to column (optional)

**Acceptance Criteria:**
- Can create column in 5 seconds
- Column names clearly visible
- Can attach file (PDF, .txt) to column

#### 7. Sharing & Access
**User Story**: As a PM, I want to share the canvas with my client so they can see what we're building.

**Features:**
- [ ] Generate shareable link
- [ ] Two access levels:
  - **View-only**: Client can see, comment, but not edit
  - **Edit**: Team can drag cards, edit details
- [ ] Email invitation with link
- [ ] Optional: Simple password protection

**Acceptance Criteria:**
- Share link works immediately (no delays)
- View-only users can't drag or delete
- Email sent successfully with link
- Client can access without account (for MVP)

#### 8. Comments & Discussion
**User Story**: As a client or PM, I want to comment on cards to discuss or clarify.

**Features:**
- [ ] Comment thread on each card
- [ ] Display commenter name and timestamp
- [ ] Mention others (@name)
- [ ] Notifications for new comments (email)

**Acceptance Criteria:**
- Comments post instantly
- Email notification sent within 1 minute
- Can see all comments in timeline order

### Phase 3: Change Tracking (Weeks 7-8)

#### 9. Meeting Notes Integration (Simplified)
**User Story**: As a PM, I want to upload meeting notes and have AI suggest scope changes.

**Features:**
- [ ] Attach meeting notes to a column (PDF, .txt, or paste text)
- [ ] AI analyzes notes and suggests:
  - New cards to add
  - Existing cards to modify
  - Changes to card descriptions
- [ ] Display AI suggestions with "Accept" or "Edit" buttons
- [ ] PM reviews and approves before cards update

**Acceptance Criteria:**
- AI processes notes within 60 seconds
- Suggests at least 50% relevant changes (based on PM feedback)
- PM can override any suggestion
- Changes only apply after PM approval

**Technical Approach:**
```python
def analyze_meeting_notes(notes_text, existing_cards):
    prompt = """
    Analyze these meeting notes and compare to existing scope cards.
    Identify:
    1. New features mentioned (create new cards)
    2. Changes to existing features (suggest edits)
    3. Features removed or deprioritized
    
    Existing cards:
    {existing_cards}
    
    Meeting notes:
    {notes_text}
    
    Return suggested changes as JSON.
    """
    
    response = llm.generate(prompt)
    suggestions = parse_json(response)
    return suggestions
```

#### 10. Change History
**User Story**: As a PM or client, I want to see how scope evolved over time.

**Features:**
- [ ] Timeline view showing all columns chronologically
- [ ] Click on card to see its version history
- [ ] Visual diff showing what changed (strikethrough old, highlight new)
- [ ] Filter by card or by column

**Acceptance Criteria:**
- Can view history for any card
- Diff clearly shows additions (green) and deletions (red)
- Timeline loads in < 2 seconds

### Phase 4: Polish & Export (Week 9-10)

#### 11. Export & Reporting
**User Story**: As a PM, I want to export the current scope as a PDF to share with stakeholders.

**Features:**
- [ ] "Export to PDF" button
- [ ] Generate clean PDF with:
  - Project name, client, date
  - All cards in current state
  - Grouped by column
  - Include card details
- [ ] Download immediately

**Acceptance Criteria:**
- PDF generated in < 10 seconds
- Formatting is clean and professional
- Includes all visible cards

#### 12. Demo Preparation Tools (Nice-to-Have)
**User Story**: As a PM, I want to prepare for demos by filtering to demo-ready cards.

**Features:**
- [ ] Mark cards as "Demo Ready"
- [ ] Filter view to show only demo-ready cards
- [ ] Generate simple checklist from cards
- [ ] Print-friendly view

**Acceptance Criteria:**
- Can toggle demo-ready status on card
- Filter applies instantly
- Checklist includes all demo-ready cards

---

## What's NOT in MVP

### Explicitly Out of Scope (for MVP)
- ❌ User authentication (use magic links for access)
- ❌ Mobile app (web-only, mobile responsive)
- ❌ Jira integration (future)
- ❌ Real-time collaboration (multiple users editing simultaneously)
- ❌ Advanced AI (effort estimation, risk detection)
- ❌ Arabic language support (English only for MVP)
- ❌ On-premises deployment (cloud-only)
- ❌ Usage analytics dashboard
- ❌ Template library
- ❌ Video recording integration
- ❌ Dependency mapping between cards
- ❌ Gantt chart / timeline views
- ❌ Budget/cost tracking

These features can be added in future versions based on feedback.

---

## Technical Stack (MVP)

### Frontend
- **Framework**: React 18 + TypeScript
- **Canvas Library**: React Flow (for drag-drop canvas)
- **UI Components**: shadcn/ui (Tailwind CSS)
- **State Management**: Zustand (lightweight)
- **Routing**: React Router
- **Deployment**: Vercel or Netlify

### Backend
- **Framework**: FastAPI (Python)
- **Database**: PostgreSQL (via Supabase or Railway)
- **File Storage**: AWS S3 or Cloudflare R2
- **Authentication**: Magic links (email-based, no passwords for MVP)
- **API**: RESTful, JSON responses

### AI/ML
- **LLM Provider**: OpenAI GPT-4 (via API)
  - Backup: Anthropic Claude
- **Document Parsing**: PyPDF2 (PDFs), python-docx (Word)
- **Prompts**: Stored in code, versioned

### Infrastructure
- **Hosting**: Railway or Render (backend), Vercel (frontend)
- **Database**: Managed PostgreSQL (Supabase or Railway)
- **Domain**: *.mometric.ai or similar
- **SSL**: Auto-provisioned via platform
- **Monitoring**: Sentry (errors), Plausible (analytics)

### Development Tools
- **Version Control**: Git + GitHub
- **CI/CD**: GitHub Actions
- **Linting**: ESLint (frontend), Black (backend)
- **Testing**: Vitest (frontend unit tests), Pytest (backend)
  - Note: Minimal testing for MVP, focus on manual QA

---

## Data Model (Simplified for MVP)

```sql
-- Projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    client_name VARCHAR(255),
    created_at TIMESTAMP,
    scope_document_url TEXT,
    share_token VARCHAR(64) UNIQUE
);

-- Columns table (stages in canvas)
CREATE TABLE columns (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    name VARCHAR(255),
    order_index INTEGER,
    meeting_notes_url TEXT,
    created_at TIMESTAMP
);

-- Cards table
CREATE TABLE cards (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    column_id UUID REFERENCES columns(id),
    title VARCHAR(255),
    description TEXT,
    business_value TEXT,
    status VARCHAR(50), -- 'not_started', 'in_progress', 'done'
    demo_ready BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Card history table (for change tracking)
CREATE TABLE card_versions (
    id UUID PRIMARY KEY,
    card_id UUID REFERENCES cards(id),
    column_id UUID REFERENCES columns(id),
    field_name VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    changed_at TIMESTAMP,
    changed_by VARCHAR(255) -- email or name
);

-- Comments table
CREATE TABLE comments (
    id UUID PRIMARY KEY,
    card_id UUID REFERENCES cards(id),
    author_name VARCHAR(255),
    author_email VARCHAR(255),
    content TEXT,
    created_at TIMESTAMP
);

-- Team members table (optional for MVP)
CREATE TABLE team_members (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    email VARCHAR(255),
    role VARCHAR(50), -- 'owner', 'editor', 'viewer'
    added_at TIMESTAMP
);
```

---

## Development Phases & Timeline

### Week 1-2: Foundation
- [ ] Set up repo (frontend + backend)
- [ ] Configure dev environment
- [ ] Set up database and tables
- [ ] Implement basic auth (magic links)
- [ ] Create project CRUD endpoints
- [ ] Build basic UI shell

### Week 3-4: Core Canvas
- [ ] Implement AI scope extraction
- [ ] Build canvas UI with React Flow
- [ ] Card display and detail view
- [ ] Drag-drop between columns
- [ ] Manual card creation/editing

### Week 5-6: Collaboration
- [ ] Column creation and management
- [ ] Shareable links (view-only mode)
- [ ] Comments on cards
- [ ] Email notifications

### Week 7-8: AI Meeting Analysis
- [ ] Meeting notes upload
- [ ] AI analysis of notes
- [ ] Suggestion approval workflow
- [ ] Change history and diff view

### Week 9-10: Polish & Launch
- [ ] Export to PDF
- [ ] Demo preparation tools
- [ ] Bug fixes and UX improvements
- [ ] Internal documentation
- [ ] Launch to team

### Week 11-14: Internal Dogfooding
- [ ] Use on 3-5 real AI projects
- [ ] Gather team feedback
- [ ] Iterate on pain points
- [ ] Track success metrics

---

## Success Metrics (How We'll Measure MVP)

### Leading Indicators (During Development)
- Team actually uses it (not forced)
- Positive feedback during weekly retros
- Clients engage with canvas (views, comments)
- Fewer "wait, what?" moments in meetings

### Lagging Indicators (After 3 Months)
1. **Scope Alignment**
   - Measure: # of "surprise" scope requests during demos
   - Target: 50% reduction vs pre-canvas projects

2. **Client Satisfaction**
   - Measure: Post-demo survey (1-10 scale)
   - Target: Average 8+ (vs current ~6-7)

3. **Time Savings**
   - Measure: Hours spent on scope clarification meetings
   - Target: 30% reduction (e.g., 10 hours → 7 hours)

4. **Adoption**
   - Measure: % of new projects using canvas
   - Target: 100% within 3 months

5. **Team NPS**
   - Measure: "How likely are you to recommend this tool?" (0-10)
   - Target: 7+ (promoters)

### How We'll Collect Data
- **Quantitative**: Track metrics in spreadsheet for each project
- **Qualitative**: Weekly team feedback sessions, client interviews
- **Comparison**: Before/after metrics (pre-canvas vs post-canvas projects)

---

## MVP Launch Plan

### Internal Soft Launch (Week 10)
1. **Demo to team**: Show final MVP, walkthrough
2. **Documentation**: Create internal user guide
3. **First project**: Pick upcoming AI chatbot project
4. **PM training**: 1-hour session on how to use effectively

### First Real Projects (Weeks 11-14)
1. **Project selection**: 3-5 upcoming AI projects
2. **Client intro**: "We're testing a new tool to keep us aligned"
3. **Hybrid approach**: Use canvas + traditional docs
4. **Weekly check-ins**: How's it going? What's missing?

### Feedback & Iteration (Weeks 15-18)
1. **Collect feedback**: Surveys, interviews, usage data
2. **Prioritize fixes**: What's blocking adoption?
3. **Quick iterations**: Deploy fixes weekly
4. **Decide on next phase**: External beta or more internal use?

---

## Go/No-Go Criteria (After 3 Months)

### Go to External Beta If:
✅ Team uses it on 80%+ of projects voluntarily
✅ Client satisfaction improved measurably
✅ Time savings demonstrated
✅ No major technical issues
✅ Team rates it 7+ NPS
✅ At least 2 strong success stories/testimonials

### Continue Internal-Only If:
⚠️ Adoption is 50-80% (promising but needs work)
⚠️ Client satisfaction improved slightly
⚠️ Some time savings but not dramatic
⚠️ Technical issues exist but fixable
⚠️ Team rates it 5-7 NPS (neutral)

### Pivot or Stop If:
❌ Adoption < 50% after encouragement
❌ No measurable improvement in satisfaction or time
❌ Team actively avoids using it
❌ Technical issues too costly to fix
❌ Team rates it < 5 NPS (detractors)

---

## Risks & Mitigation Plans

### Risk 1: AI Extraction Accuracy Too Low
**Risk**: AI extracts wrong or irrelevant cards, PM has to redo everything
**Early Signal**: PMs delete >50% of AI-generated cards
**Mitigation**:
- Improve prompts based on real scope docs
- Add few-shot examples to prompt
- Make manual card creation super easy as fallback
- If still poor, reduce AI scope (only suggest, don't auto-create)

### Risk 2: Team Doesn't Adopt
**Risk**: Team prefers old methods (Word docs, Jira), sees this as extra work
**Early Signal**: Low usage after 2 weeks
**Mitigation**:
- Address friction points immediately
- Show quick wins (time saved)
- Make it easier than current process
- Get buy-in from PM lead
- If still low: mandatory for 1 project to get real feedback

### Risk 3: Clients Don't Engage
**Risk**: Clients don't look at canvas, prefer email updates
**Early Signal**: Zero comments or views on canvas
**Mitigation**:
- Walk clients through in first meeting
- Send email summaries with canvas link
- Make viewing frictionless (no login)
- If still low: reassess value prop (maybe not painful enough?)

### Risk 4: Scope Too Big, Timeline Slips
**Risk**: MVP takes >10 weeks, team loses momentum
**Early Signal**: Behind schedule after week 4
**Mitigation**:
- Cut nice-to-have features aggressively
- Focus on core flow: upload → extract → visualize → share
- Time-box: whatever works by week 10 is MVP
- Defer polish to post-launch iterations

### Risk 5: Technical Complexity (Canvas UI)
**Risk**: Building drag-drop canvas harder than expected
**Early Signal**: Week 3-4 taking longer than planned
**Mitigation**:
- Use proven library (React Flow)
- Simplify interactions (maybe no drag-drop initially?)
- Manual column assignment if drag-drop too hard
- Focus on mobile-responsive later (desktop-first)

---

## Budget Estimate (MVP)

### Development Time
- **Frontend dev**: 150 hours @ $75/hr = $11,250
- **Backend dev**: 100 hours @ $75/hr = $7,500
- **Design/UX**: 40 hours @ $75/hr = $3,000
- **PM/coordination**: 40 hours @ $75/hr = $3,000
- **Total labor**: ~$25,000 (or 330 hours)

### Operational Costs (First 3 Months)
- **Cloud hosting**: $50/month × 3 = $150
- **AI API (OpenAI)**: $200/month × 3 = $600 (generous estimate)
- **Domain & SSL**: $50/year = $50
- **Tools (Sentry, etc.)**: $50/month × 3 = $150
- **Total ops**: ~$1,000

### Total MVP Cost: ~$26,000
(If building with internal team, this is opportunity cost)

---

## Post-MVP Roadmap (If Successful)

### Version 1.1 (Months 4-6)
- [ ] User authentication (proper accounts)
- [ ] Jira integration (link cards to tasks)
- [ ] Arabic language support
- [ ] Mobile app (or better mobile web)
- [ ] Advanced AI (better suggestions)

### Version 1.5 (Months 7-9)
- [ ] KPI Mapping module integration
- [ ] Template library (chatbot project, data pipeline, etc.)
- [ ] Effort estimation per card
- [ ] Dependency mapping between cards
- [ ] External beta with 5-10 customers

### Version 2.0 (Months 10-12)
- [ ] On-premises deployment option
- [ ] Marketplace for templates
- [ ] Advanced analytics (scope drift, risk detection)
- [ ] Full commercial launch

---

## Key Decisions to Make Before Starting

### Decision 1: Build vs Buy Canvas Library?
**Options:**
- A) Use React Flow (open-source, proven)
- B) Build custom canvas from scratch
- C) Use other library (Konva, Fabric.js)

**Recommendation**: A) React Flow - proven, active community, good docs

### Decision 2: Which AI Provider?
**Options:**
- A) OpenAI GPT-4 (expensive but best)
- B) Anthropic Claude (good, slightly cheaper)
- C) Open-source (LLaMA, Mistral - cheapest but requires hosting)

**Recommendation**: A) OpenAI for MVP, add Claude as backup

### Decision 3: Authentication Approach?
**Options:**
- A) Magic links (email-only, no passwords)
- B) Email + password
- C) OAuth (Google, Microsoft)
- D) No auth (just share tokens)

**Recommendation**: A) Magic links for MVP (simplest, good UX)

### Decision 4: Database Choice?
**Options:**
- A) PostgreSQL (relational, proven)
- B) MongoDB (document-based, flexible)
- C) Firebase (managed, easy)

**Recommendation**: A) PostgreSQL via Supabase (best balance)

### Decision 5: Deployment Strategy?
**Options:**
- A) Vercel (frontend) + Railway (backend) - separate
- B) All-in-one (Heroku, Render)
- C) Self-hosted (AWS, Azure)

**Recommendation**: A) Vercel + Railway (easy, scalable)

---

## Next Steps to Start MVP

1. **Validate with team**: Show this plan, get buy-in
2. **Assign roles**: Who's building what?
3. **Set up infrastructure**: Repos, databases, domains
4. **Sprint 0 (Week 1)**: Foundation and setup
5. **Identify first test project**: Which upcoming project will use it first?
6. **Weekly check-ins**: Review progress, unblock issues
7. **Celebrate milestones**: Demo internally at weeks 4, 7, 10

---

## Questions to Answer Before Building

1. **Who's building this?** Solo dev? Team? External contractor?
2. **What's the deadline?** Firm 10 weeks or flexible?
3. **What's the budget?** If paying external devs
4. **Who's the product owner?** Who makes final decisions?
5. **What's the first test project?** Do we have one lined up?
6. **What if MVP fails?** Are we okay with that outcome?

---

*This is a living plan. Update as we learn. Last updated: December 2024*



