# Hojaa Product Structure

## Overview

Hojaa is an end-to-end platform that takes businesses from initial idea through execution to measurement. It combines AI-powered scope clarity, business-data mapping, and KPI tracking into a cohesive workflow.

---

## Product Vision

**"From ideation to impact — automatically map business objectives to data and execution"**

Hojaa helps enterprises and project teams:
1. **Clarify** what they want to build (Ideation → Scope)
2. **Align** stakeholders on deliverables (Scope Canvas)
3. **Map** business goals to data structures (KPI/Data Mapping)
4. **Measure** success with proper KPI tracking

---

## Module Architecture

Hojaa is organized into four interconnected modules:

```
┌─────────────────────────────────────────────────────────────┐
│                        Hojaa Platform                      │
└─────────────────────────────────────────────────────────────┘
         │
         ├─── 📋 Module 1: Ideation
         │         └─ Capture business concept and objectives
         │
         ├─── 🎯 Module 2: Use Cases
         │         └─ Define what needs to happen
         │
         ├─── 📄 Module 3: Scope Canvas
         │         └─ Extract deliverables, align with stakeholders
         │
         └─── 🔗 Module 4: KPI & Data Mapping
                   └─ Map KPIs to data sources, create business graph
```

---

## Module 1: Ideation

### Purpose
Capture and structure initial business concepts, problems, and objectives.

### User Persona
- Business leaders
- Product owners
- Consultants
- Entrepreneurs

### Key Features
- **Freeform concept capture**: Write or speak your idea
- **Problem statement extraction**: AI helps articulate the problem you're solving
- **Objective definition**: What success looks like
- **Stakeholder identification**: Who cares about this?
- **Initial use case brainstorming**: What should the solution do?

### Output
A structured ideation document that feeds into Use Cases module.

### Example Flow
1. User writes: "We want to reduce customer churn by improving support response times"
2. AI extracts:
   - **Problem**: High customer churn due to slow support
   - **Objective**: Improve support response times
   - **Stakeholders**: Support team, customers, customer success
   - **Potential solutions**: Chatbot, better ticketing, agent training
3. User refines and approves
4. Document becomes foundation for next steps

---

## Module 2: Use Cases

### Purpose
Break down business objectives into specific, actionable use cases.

### User Persona
- Business analysts
- Product managers
- Consultants

### Key Features
- **Import from Ideation**: Pull objectives automatically
- **Use case templates**: Standard formats for different industries
- **Actor-action-outcome structure**: Who does what to achieve what?
- **Prioritization**: Must-have vs nice-to-have
- **Use case relationships**: Dependencies between use cases

### Output
A catalog of prioritized use cases that inform scope and requirements.

### Example Flow
1. Objective: "Improve support response times"
2. AI suggests use cases:
   - UC1: Customer can ask questions via chatbot
   - UC2: Chatbot provides instant answers for common questions
   - UC3: Chatbot escalates complex questions to human agent
   - UC4: Agent sees chatbot conversation history
3. User prioritizes: UC1, UC2 are must-have; UC3, UC4 for later
4. Use cases become inputs to Scope Canvas

---

## Module 3: Scope Canvas

### Purpose
Transform use cases and scope documents into visual, client-friendly deliverables that keep stakeholders aligned throughout project lifecycle.

### User Persona
- Project managers
- Developers
- Clients (non-technical)
- Consultants

### Key Features
- **Scope document upload**: PDF/Word/Text
- **AI extraction**: Convert scope → visual cards
- **Client-friendly language**: No technical jargon
- **Visual timeline**: Columns show scope evolution
- **Meeting integration**: Upload meeting notes, AI detects changes
- **Change tracking**: Full history of scope modifications
- **Demo preparation**: Generate checklists from cards

### Output
A living, visual canvas that shows what's being built in plain language.

### Example Flow
1. PM uploads scope doc: "Build AI chatbot for customer support"
2. AI extracts cards:
   - "Chatbot answers frequently asked questions"
   - "Chatbot understands customer intent"
   - "Chatbot hands off to human when needed"
3. Client reviews and approves cards
4. After meeting, PM uploads notes: "Client wants returns handled too"
5. AI adds new card: "Chatbot helps customers with returns"
6. Client sees update and approves
7. During demo, PM shows each card → corresponding feature

### Integration Point
Scope Canvas feeds into KPI Mapping: deliverables become "use cases" in the business graph.

---

## Module 4: KPI & Data Mapping

### Purpose
Map business objectives and KPIs to actual enterprise data sources, creating a graph that shows lineage from strategic goals to raw data.

### User Persona
- Data analysts
- Business intelligence teams
- Enterprise architects
- Consultants

### Key Features
- **Database schema ingestion**: Connect to databases, auto-read schema
- **KPI definition**: Input business KPIs
- **AI-assisted mapping**: Suggest data sources for KPIs
- **Graph visualization**: Objective → KPI → Use Case → Data Entity
- **Multi-level hierarchy**: Enterprise → Business Unit → Department
- **Lineage tracking**: Trace KPI back to source tables
- **Impact analysis**: If schema changes, show affected KPIs

### Output
An interactive graph showing the complete lineage from business strategy to data.

### Example Flow
1. User connects to customer database
2. System reads schema: `customers`, `tickets`, `responses` tables
3. User defines KPI: "Average Support Response Time"
4. AI suggests: Uses `tickets.created_at` and `responses.timestamp`
5. User confirms mapping
6. Graph shows: 
   - Objective: "Improve support" 
   - → KPI: "Avg Response Time" 
   - → Use Case: "Chatbot instant responses"
   - → Data: `tickets`, `responses` tables
7. If `responses` table structure changes, system alerts: "KPI 'Avg Response Time' affected"

---

## Data Flow Between Modules

### Forward Flow (Ideation → Execution)

```
Ideation
  └─ Business objectives
       │
       ▼
  Use Cases
  └─ Prioritized use cases
       │
       ▼
  Scope Canvas
  └─ Client-approved deliverables
       │
       ▼
  KPI & Data Mapping
  └─ KPIs mapped to data sources
       │
       ▼
  [External: Development in Jira/ClickUp]
  [External: Analytics in PowerBI/Tableau]
```

### Backward Flow (Measurement → Strategy)

```
KPI Dashboard (in BI tool)
  └─ KPI values are off-target
       │
       ▼
  KPI & Data Mapping
  └─ Check data lineage, identify issues
       │
       ▼
  Scope Canvas
  └─ Was this feature delivered correctly?
       │
       ▼
  Use Cases
  └─ Should we adjust use cases?
       │
       ▼
  Ideation
  └─ Re-evaluate business objective
```

---

## User Journeys

### Journey 1: AI Product Team (MVP Target)

**Scenario**: Building a customer support chatbot for a client

**Steps:**
1. **Ideation**: Document client's goal to improve support efficiency
2. **Use Cases**: Define chatbot capabilities (FAQ, escalation, etc.)
3. **Scope Canvas**: 
   - Upload scope doc
   - Extract cards like "Answer FAQs", "Escalate to human"
   - Share with client for alignment
   - Update after weekly meetings
4. **Development**: (External - Jira) Build chatbot
5. **Demo**: Use canvas to show what was delivered
6. **Post-Launch**: (Future) Use KPI Mapping to track chatbot effectiveness

### Journey 2: Enterprise Consultant

**Scenario**: Large utility company wants to improve operational efficiency

**Steps:**
1. **Ideation**: Workshop with stakeholders, capture objectives
2. **Use Cases**: Define operational use cases across departments
3. **KPI & Data Mapping**:
   - Connect to enterprise data warehouse
   - Map existing KPIs to data sources
   - Identify gaps (KPIs without data)
   - Create graph showing objective → KPI → data lineage
4. **Scope Canvas**: (If building new tools) Define deliverables to fill gaps
5. **Ongoing**: Use graph for governance, impact analysis

### Journey 3: Startup Founder

**Scenario**: Building a new SaaS product, needs to define and track KPIs

**Steps:**
1. **Ideation**: Document product vision and business model
2. **Use Cases**: Define core product features
3. **Scope Canvas**: Create MVP scope, align with co-founders/investors
4. **Development**: Build product
5. **KPI & Data Mapping**: 
   - Connect to product database
   - Define growth KPIs (MRR, churn, engagement)
   - Map KPIs to data sources
   - Share graph with investors to show data-driven approach

---

## Module Dependencies

### Independent Modules (Can Use Standalone)
- **Scope Canvas**: Can be used for any project without other modules
- **KPI & Data Mapping**: Can be used for existing enterprises without Ideation/Scope

### Sequential Modules (Best Used in Order)
- Ideation → Use Cases → Scope Canvas → KPI Mapping (full lifecycle)

### Optional Integrations
- Scope Canvas ↔ Jira/ClickUp: Link cards to technical tasks
- KPI Mapping ↔ PowerBI/Tableau: Feed graph into BI tools
- All modules ↔ External AI tools: Import from/export to other AI systems

---

## Technology Architecture (High-Level)

### Frontend
- **Framework**: React + TypeScript
- **Canvas UI**: React Flow or custom canvas library
- **Graph Visualization**: D3.js or Cytoscape.js
- **State Management**: Redux or Zustand
- **UI Components**: Tailwind CSS + shadcn/ui

### Backend
- **API**: Python (FastAPI) or Node.js (Express)
- **Database**: PostgreSQL for structured data
- **Graph Database**: Neo4j for KPI/data relationships (optional)
- **File Storage**: S3 or Azure Blob for documents
- **Auth**: JWT + OAuth (for enterprise SSO)

### AI/ML
- **LLM Provider**: OpenAI GPT-4 or Claude (Anthropic)
- **Vector DB**: Pinecone or Weaviate (for semantic search in scope docs)
- **Framework**: LangChain or LlamaIndex for AI workflows
- **Local AI**: Option for air-gap deployments (LLaMA, Mistral)

### Deployment
- **Cloud**: Azure (KSA regions for data residency)
- **On-Prem**: Docker + Kubernetes
- **Air-Gap**: Standalone installer with local AI models

### Integrations
- **BI Tools**: PowerBI, Tableau (APIs for KPI export)
- **Project Management**: Jira, ClickUp (via APIs)
- **Meeting Tools**: Read.ai, Otter.ai (transcript import)
- **Databases**: Connectors for SQL Server, Oracle, PostgreSQL, MySQL

---

## Deployment Models

### Model 1: Cloud SaaS (Initial)
- Hosted on Azure
- Multi-tenant architecture
- Subscription-based pricing
- Easiest for initial customers

### Model 2: On-Premises (Phase 2)
- Customer hosts in their data center
- Single-tenant
- License-based pricing
- Required for government/regulated industries in KSA

### Model 3: Air-Gap (Phase 3)
- Fully offline installation
- Local AI models (no internet required)
- For defense, sensitive government agencies
- Premium pricing + implementation services

---

## Pricing Strategy (Initial Thoughts)

### Scope Canvas Only (MVP)
- **Starter**: $99/month - 3 projects, 5 users
- **Professional**: $299/month - 10 projects, unlimited users
- **Enterprise**: Custom - unlimited projects, on-prem option

### Full Platform (All Modules)
- **Starter**: $299/month - Basic features, 3 projects
- **Professional**: $999/month - All features, 20 projects
- **Enterprise**: $5,000+/month - On-prem, air-gap, dedicated support

### Consulting Add-Ons
- Implementation: $10,000 - $50,000 (depending on complexity)
- Training: $2,000/day
- Custom integrations: $5,000 - $20,000

---

## Competitive Positioning

### Primary Competitors (by Module)

**Scope Canvas:**
- Traditional: Word docs, Excel, Email
- Visual: Miro, Figma (but not AI-powered)
- PM Tools: Jira, ClickUp (but too technical for clients)

**KPI Mapping:**
- Strategy: KPI Karta (doesn't connect to data)
- Data Catalog: Alation, Collibra (too technical, no KPI focus)
- BI: PowerBI, Tableau (visualization, not strategy mapping)

### Hojaa's Unique Position
**"The only platform that connects business strategy to data execution with AI"**

- Combines scope clarity + KPI mapping (others do one or the other)
- Client-friendly (not just for data teams)
- AI-powered throughout
- Deployment flexibility (cloud/on-prem/air-gap)
- Built for KSA/Middle East market

---

## Go-to-Market Strategy

### Phase 1: Internal Use (MVP)
- **Target**: Our own AI projects
- **Goal**: Validate with real projects, iterate quickly
- **Success**: Reduce scope drift by 50%, improve client satisfaction

### Phase 2: Friendly Customers
- **Target**: Existing consulting clients
- **Offer**: Free/discounted for feedback
- **Goal**: Get 5-10 case studies
- **Success**: 80% would pay for it, measurable ROI

### Phase 3: Regional Launch (KSA/GCC)
- **Target**: Consulting firms, government agencies, enterprises
- **Channels**: Direct sales, partnerships with consulting firms
- **Marketing**: Case studies, webinars, industry events
- **Success**: 50 paying customers, $500K ARR

### Phase 4: Global Expansion
- **Target**: Global enterprises, SaaS companies
- **Channels**: Online marketing, partnerships with BI vendors
- **Localization**: Additional languages beyond English/Arabic
- **Success**: $5M ARR, Series A funding

---

## Success Metrics (Product-Level)

### Engagement
- Daily/weekly active users
- Projects created per account
- Time spent in each module
- Module adoption rate (% using 1 vs 2 vs 3+ modules)

### Value Delivery
- Time to align on scope (vs traditional methods)
- Reduction in scope change requests
- Client satisfaction scores
- Number of KPIs mapped
- Data sources connected

### Business
- Monthly Recurring Revenue (MRR)
- Customer Acquisition Cost (CAC)
- Customer Lifetime Value (LTV)
- Churn rate
- Net Promoter Score (NPS)

---

## Roadmap Timeline

### Q1 2025: MVP (Scope Canvas)
- Build core Scope Canvas functionality
- Use internally on 3-5 AI projects
- Validate pain point resolution
- Iterate based on team feedback

### Q2 2025: Beta (Scope Canvas + KPI Mapping)
- Add KPI & Data Mapping module
- Offer to 5-10 friendly customers
- Build Ideation and Use Cases modules (basic versions)
- Gather case studies and testimonials

### Q3 2025: Launch (Full Platform)
- All modules production-ready
- Regional launch in KSA/GCC
- Establish partnerships with consulting firms
- Marketing campaign (webinars, content, events)

### Q4 2025: Scale
- On-premises deployment option
- Advanced AI features (better suggestions, impact analysis)
- Integrations with major tools (Jira, PowerBI)
- Expand to 50+ customers

### 2026: Enterprise & Global
- Air-gap deployment for government
- Multi-language support
- Global expansion beyond Middle East
- Marketplace for templates and integrations

---

## Risk Assessment

### Technical Risks
- **AI accuracy**: Scope extraction and suggestions may not be perfect
  - *Mitigation*: Human review, continuous learning, user corrections
- **Scalability**: Graph visualization may lag with huge datasets
  - *Mitigation*: Progressive loading, caching, graph database
- **Integration complexity**: Many databases/tools to connect to
  - *Mitigation*: Start with most common, build connectors incrementally

### Market Risks
- **Adoption**: Teams may not change from existing tools
  - *Mitigation*: Start internal, prove ROI with data, offer migration help
- **Competition**: Large players (Microsoft, Atlassian) may build similar
  - *Mitigation*: Move fast, focus on niche (KSA, consultants), deepen AI moat
- **Pricing**: May be hard to price correctly initially
  - *Mitigation*: Flexible pricing during beta, learn willingness to pay

### Operational Risks
- **Support burden**: Complex enterprise software needs support
  - *Mitigation*: Build good docs, in-app help, partner for support
- **Customization requests**: Enterprises may want heavy customization
  - *Mitigation*: Build flexible platform, offer professional services

---

## Next Steps

1. **Build MVP**: Focus on Scope Canvas first
2. **Dogfood internally**: Use on every AI project
3. **Measure impact**: Track time to align, scope changes, satisfaction
4. **Document learnings**: What works, what doesn't
5. **Iterate**: Fix pain points before offering to customers
6. **Prepare for beta**: Build marketing materials, case studies
7. **Plan KPI Mapping module**: While Canvas is being validated

---

## Open Questions

1. **Should we build all modules from day 1, or ship Scope Canvas standalone first?**
   - Leaning towards: Scope Canvas first (faster to market, clearer value prop)

2. **How tightly should modules integrate, or should they be usable independently?**
   - Leaning towards: Loose coupling, can use independently, better together

3. **What's the right balance of AI automation vs human control?**
   - Leaning towards: AI suggests, human approves (trust but verify)

4. **Should we target B2B (consultants/agencies) or B2C (individual PMs/teams)?**
   - Leaning towards: B2B first (higher willingness to pay, stickier)

5. **How much should we customize for KSA/Middle East vs build globally?**
   - Leaning towards: Arabic language + local regulations, but product is global-ready

---

*This document will evolve as we build and learn. Last updated: December 2024*



