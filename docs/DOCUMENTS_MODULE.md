# Documents Module — Full Functionality Reference

> **Module**: Documents Tab (per-project)  
> **Location**: `/projects/{id}/documents`  
> **Purpose**: Create, edit, and share professional business documents with AI-powered content generation, live previews, version control, pricing tables, and export capabilities.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Document Lifecycle & Status Flow](#2-document-lifecycle--status-flow)
3. [Document List View](#3-document-list-view)
4. [Document Editor](#4-document-editor)
5. [AI Chat Assistant](#5-ai-chat-assistant)
6. [Template System](#6-template-system)
7. [Variable System](#7-variable-system)
8. [Pricing Table](#8-pricing-table)
9. [Version History](#9-version-history)
10. [Document Sharing & Recipients](#10-document-sharing--recipients)
11. [Export — PDF & DOCX](#11-export--pdf--docx)
12. [Live Preview Panel](#12-live-preview-panel)
13. [Mermaid Diagrams](#13-mermaid-diagrams)
14. [Public Shared Document Viewer](#14-public-shared-document-viewer)
15. [Auto-Save System](#15-auto-save-system)
16. [Backend API Reference](#16-backend-api-reference)
17. [AI Service Internals](#17-ai-service-internals)
18. [File Map](#18-file-map)

---

## 1. Architecture Overview

The Documents module is a full-featured document authoring system integrated into each Hojaa project. It combines a block-based rich text editor (BlockNote) with an AI chat assistant that can generate, edit, and restructure entire documents using the project's scope tree, planning cards, and team information as context.

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Editor | **BlockNote v0.47+** | Block-based rich text editing with custom schema extensions |
| Frontend | **Next.js + TypeScript + Tailwind CSS** | UI components, routing, state management |
| Backend | **FastAPI + SQLAlchemy** | REST API (25+ endpoints), database ORM |
| AI | **OpenAI / Anthropic** | LLM-powered content generation with multi-provider support |
| Diagrams | **Mermaid.js** | Flowcharts, Gantt charts, sequence diagrams, pie charts, mindmaps |
| Export | **fpdf2** (PDF), **python-docx** (DOCX) | Server-side document rendering and download |

### Data Flow

```
User types in AI Chat
    → POST /api/documents/{id}/ai/chat
    → Backend builds project context (scope tree, cards, team)
    → LLM generates full document with ---DOCUMENT_START---/---DOCUMENT_END--- markers
    → Backend extracts markdown, converts to BlockNote JSON via markdown_to_blocknote()
    → apply_blocks_to_document() saves updated content to DB
    → Frontend receives { auto_applied: true, updated_content: [...] }
    → DocumentEditor.replaceBlocks() updates the editor atomically
    → Auto-save skips next cycle (skipNextAutoSaveRef)
```

---

## 2. Document Lifecycle & Status Flow

Each document progresses through a lifecycle:

```
┌─────────┐     ┌──────┐     ┌────────┐     ┌───────────┐
│  DRAFT  │────▶│ SENT │────▶│ VIEWED │────▶│ COMPLETED │
└─────────┘     └──────┘     └────────┘     └───────────┘
```

| Status | Description | Trigger |
|--------|-------------|---------|
| `draft` | Document is being authored/edited | Default on creation |
| `sent` | Document has been sent to recipients | User clicks "Send" → `POST /{id}/send` |
| `viewed` | At least one recipient has opened the share link | Automatic when public view is accessed |
| `completed` | Document lifecycle is finished | Manual status change via `PATCH /{id}` |

**Lifecycle timestamps**: `created_at`, `updated_at`, `sent_at`, `viewed_at`, `completed_at`

---

## 3. Document List View

**Component**: `DocumentList.tsx` (339 lines)  
**Route**: `/projects/{id}/documents` (with no `?doc=` query param)

### Features

- **Status Filter Tabs**: All / Draft / Sent / Viewed / Completed — each tab filters the document grid
- **Search**: Real-time search filtering across document titles
- **Card Grid Layout**: Each document displays as a card with:
  - Title (editable inline)
  - Status badge (color-coded)
  - Creator name and avatar
  - Creation date
  - Recipient count (if any)
- **Context Menu (3-dot)**: Per-document actions:
  - **Duplicate** — `POST /{id}/duplicate` — clones the document including pricing items
  - **Download as PDF** — triggers PDF export
  - **Delete** — `DELETE /{id}` — creator/admin only
- **Create Actions**:
  - **Blank document** — `POST /session/{sessionId}` with empty title
  - **From template** — opens Template Gallery modal, then `POST /session/{sessionId}` with `template_id`
- **Skeleton Loading**: Animated placeholder cards while documents are loading
- **Empty State**: Illustrated prompt to create the first document

### API Calls

| Action | Endpoint | Method |
|--------|----------|--------|
| List documents | `/api/documents/session/{sessionId}` | GET |
| Create blank | `/api/documents/session/{sessionId}` | POST |
| Create from template | `/api/documents/session/{sessionId}` | POST (with `template_id`) |
| Delete | `/api/documents/{documentId}` | DELETE |
| Duplicate | `/api/documents/{documentId}/duplicate` | POST |

---

## 4. Document Editor

**Component**: `DocumentEditor.tsx` (706 lines)  
**Route**: `/projects/{id}/documents?doc={documentId}`

### BlockNote Integration

The editor uses **BlockNote** — a block-based rich text editor (similar to Notion). The schema is extended with a custom `MermaidBlockSpec` for rendering Mermaid diagrams directly in the editor.

**Supported block types**:
- Paragraph, Heading (H1–H3)
- Bullet list, Numbered list, Checklist
- Code block (with language detection)
- Table (rows/columns, header row styling)
- Quote / Callout
- Mermaid diagram (custom block)
- Image, Divider

### Side Panel Tabs

The editor features a collapsible right-side panel with 6 tabs:

| Tab | Icon | Component | Purpose |
|-----|------|-----------|---------|
| **AI** | SparklesIcon | `DocumentAIChat` | AI chat for content generation/editing |
| **Preview** | EyeIcon | `DocumentPreview` | Live HTML preview of the document |
| **Variables** | VariableIcon | `VariableInserter` | Insert `{{variable}}` placeholders from project data |
| **Pricing** | CurrencyDollarIcon | `PricingTableBlock` | Manage pricing line items with totals |
| **Versions** | ClockIcon | Version list + restore | Browse and restore version snapshots |
| **Share** | ShareIcon | `DocumentShareModal` | Share links, manage recipients, send |

### Key Editor Functions

#### `handleInsertAIBlocks(blocks)`
- Stamps each block with a unique `id` (UUID)
- Inserts blocks at the end of the document via `editor.insertBlocks()`
- Triggers auto-save

#### `handleDocumentUpdatedByAI(newContent)`
- Called when AI returns a full document update (`auto_applied: true`)
- Uses `editor.replaceBlocks()` to atomically replace all content
- Falls back to `editor.removeBlocks()` + `editor.insertBlocks()` if primary method fails
- Sets `skipNextAutoSaveRef` to prevent auto-save race condition

#### `handleRestoreVersion(versionId)`
- Calls `POST /{docId}/versions/{versionId}/restore`
- Replaces editor content with the version's saved blocks
- Reloads version list

#### `handleCreateVersion()`
- Calls `POST /{docId}/versions` with optional `change_summary`
- Backend auto-generates summary by comparing section headings with the previous version
- Refreshes version list

#### `handleDownloadPDF()` / `handleDownloadDOCX()`
- Fetches from `GET /{docId}/pdf` or `GET /{docId}/docx`
- Triggers browser download via `window.URL.createObjectURL()`

---

## 5. AI Chat Assistant

**Component**: `DocumentAIChat.tsx` (524 lines)  
**Backend Service**: `document_ai_service.py` (1186 lines)

### Overview

The AI chat is a side panel within the Document Editor that allows users to:
- Generate entire documents from natural language prompts
- Edit, add, remove, or restructure existing sections via conversation
- Generate Mermaid diagrams (flowcharts, Gantt charts, etc.)
- Ask questions about the document or project without modifying content

### Quick Prompts

Pre-built prompts for common document types:

| Prompt | Description |
|--------|-------------|
| **Write a Proposal** | Full project proposal based on scope tree data |
| **Executive Summary** | High-level summary of the project |
| **Scope of Work** | Detailed scope breakdown using tree nodes |
| **Generate Pricing** | Pricing breakdown from planning cards |
| **Project Scope** | Complete scope documentation |

### Diagram Prompts

Pre-built Mermaid diagram prompts:

| Prompt | Mermaid Type |
|--------|-------------|
| **Workflow Diagram** | `graph TD` — flowchart |
| **Architecture Diagram** | `graph LR` — system architecture |
| **Gantt Chart** | `gantt` — project timeline |
| **Sequence Diagram** | `sequenceDiagram` — interaction flow |
| **Mind Map** | `mindmap` — concept map |
| **Pie Chart** | `pie` — data distribution |

### Message Flow

1. **User sends message** → `sendMessage()` in `DocumentAIChat`
2. **API call** → `POST /api/documents/{id}/ai/chat` with the message
3. **Backend builds context** → Project name, scope tree (up to 100 nodes), team members, planning cards, and the full current document content (as markdown)
4. **System prompt** → Includes the context + formatting rules + marker instructions
5. **LLM call** → OpenAI (`gpt-4o`) or Anthropic (`claude-sonnet-4-20250514`) with last 20 messages of history
6. **Response parsing** → `_extract_document_content()` checks for `---DOCUMENT_START---` / `---DOCUMENT_END---` markers
7. **If markers found** (document change):
   - Markdown between markers is converted to BlockNote JSON via `markdown_to_blocknote()`
   - `apply_blocks_to_document()` replaces the entire document content (`full_replace=True`)
   - Response returns `{ auto_applied: true, updated_content: [...] }`
   - Frontend calls `onDocumentUpdated(updated_content)` → editor replaces blocks atomically
8. **If no markers** (chat-only response):
   - Response is displayed as a chat message with markdown rendering
   - If blocks are present, an "Insert at End" button appears for manual insertion

### Chat History

- Stored in `DocumentChatMessage` table (per document)
- Last 20 messages included in LLM context
- Display text is cleaned (markers stripped) for readability
- Clearable via `DELETE /api/documents/{id}/ai/history`

### Markdown Renderer

The chat displays AI responses with a custom `MarkdownRenderer` that supports:
- Standard markdown formatting (headings, bold, italic, code, lists, tables)
- **Mermaid diagram rendering**: Detects ` ```mermaid ` blocks and renders them as live interactive diagrams using the `MermaidDiagram` component
- Code block syntax highlighting

---

## 6. Template System

**Component**: `TemplateGallery.tsx` (202 lines)  
**Backend**: Template endpoints in `documents.py`

### Template Categories

| Category | Badge Color | Example |
|----------|------------|---------|
| Proposal | Blue | Project proposal template |
| Contract | Purple | Service agreement template |
| SOW | Amber | Scope of work template |
| NDA | Red | Non-disclosure agreement |
| Invoice | Green | Invoice template |

### Features

- **Template Gallery Modal** — Grid layout with category filter tabs (All, Proposal, Contract, SOW, NDA, Invoice)
- **System Templates** — Pre-built templates available to all users
- **Organization Templates** — Custom templates created by org members
- **Variable Placeholders** — Templates can contain `{{variable}}` placeholders that are resolved on creation
- **Save as Template** — Any document can be saved as a reusable template

### API Endpoints

| Action | Endpoint | Method |
|--------|----------|--------|
| List templates | `/api/documents/templates` | GET |
| Create template | `/api/documents/templates?document_id={id}` | POST |
| Delete template | `/api/documents/templates/{templateId}` | DELETE |

### Template Resolution Flow

```
User selects template in TemplateGallery
    → POST /api/documents/session/{sessionId} with template_id
    → Backend copies template content blocks
    → _resolve_variables() builds variable map from project data
    → _apply_variables_to_content() replaces all {{key}} placeholders
    → Document created with resolved content
```

---

## 7. Variable System

**Component**: `VariableInserter.tsx` (210 lines)  
**Backend**: `_resolve_variables()` in `documents.py`

### Variable Categories

| Category | Example Keys | Source |
|----------|-------------|--------|
| **Project** | `project.name`, `project.description` | Session model |
| **Organization** | `org.name` | User's organization |
| **Dates** | `date.today`, `date.created`, `date.quarter` | Computed |
| **Team** | `team.count`, `team.member.1.name`, `team.member.1.role`, `team.member.1.email` | TeamMember records |
| **Client** | `client.name`, `client.email` | First "Client" role member |

### Features

- **Search** — Filter variables by key, label, or resolved value
- **Grouped Display** — Variables organized by category with headers
- **Copy to Clipboard** — Click to copy `{{variable.key}}` syntax
- **Insert into Document** — Click to insert variable at cursor position
- **Live Resolution** — Variables show their current resolved values from project data

---

## 8. Pricing Table

**Component**: `PricingTableBlock.tsx` (482 lines)  
**Backend**: Pricing endpoints in `documents.py`

### Features

- **Line Item Management**: Add, edit, delete pricing line items
- **Fields per item**: Name, description, quantity, unit price, discount %, tax %, optional flag
- **Live Calculations**: Subtotal, total tax, grand total computed client-side and server-side
- **Formula**: `line_total = quantity × unit_price × (1 - discount%) × (1 + tax%)`
- **Import from Planning Cards**: Auto-generate line items from planning cards with estimated hours
  - User provides hourly rate
  - Each card with `estimated_hours > 0` becomes a line item where `quantity = estimated_hours`
- **Optional Items**: Items can be marked as optional (excluded from grand total unless selected)
- **Inline Editing**: All fields are editable directly in the table — changes auto-save on blur
- **Saving Indicators**: Per-row saving spinners during API calls

### API Endpoints

| Action | Endpoint | Method |
|--------|----------|--------|
| Get pricing | `/api/documents/{id}/pricing` | GET |
| Add item | `/api/documents/{id}/pricing` | POST |
| Update item | `/api/documents/pricing/{itemId}` | PATCH |
| Delete item | `/api/documents/pricing/{itemId}` | DELETE |
| Import from cards | `/api/documents/{id}/pricing/from-cards` | POST |

---

## 9. Version History

**UI**: Versions panel in `DocumentEditor.tsx`  
**Backend**: Version endpoints in `documents.py`

### Features

- **Create Version Snapshot**: Save a named point-in-time copy of the document content
- **Auto-Generated Summaries**: When no summary is provided, the backend analyzes the document:
  - Lists new section headings compared to the previous version
  - Reports block count changes (e.g., "+12 blocks" or "Added: Pricing, Timeline")
- **Rename Versions**: Edit the `change_summary` of any version via `PATCH`
- **Restore Version**: Replace the current document content with a previous version's content
- **Version Preview**: Each version shows section headings as a content preview
- **Author Tracking**: Each version records who created it

### API Endpoints

| Action | Endpoint | Method |
|--------|----------|--------|
| List versions | `/api/documents/{id}/versions` | GET |
| Create version | `/api/documents/{id}/versions` | POST |
| Get version | `/api/documents/{id}/versions/{versionId}` | GET |
| Rename version | `/api/documents/{id}/versions/{versionId}` | PATCH |
| Restore version | `/api/documents/{id}/versions/{versionId}/restore` | POST |

---

## 10. Document Sharing & Recipients

**Component**: `DocumentShareModal.tsx` (331 lines)  
**Backend**: Sharing endpoints in `documents.py`

### Features

- **Share Link Generation**: Creates a unique `share_token` (URL-safe, 32 chars) for the document
- **Copy Link**: One-click copy of the share URL (`/documents/shared/{token}`)
- **Add Recipients**: Form to add recipients with:
  - Name
  - Email
  - Role: `viewer` or `approver`
  - Each recipient gets their own unique `access_token`
- **Remove Recipients**: Delete individual recipients
- **Send Document**: Mark document as "sent" and update `sent_at` timestamps on all recipients
- **Recipient Status Tracking**: Visual indicators per recipient:
  - **Pending** (gray dot) — not yet sent
  - **Sent** (blue dot) — email sent
  - **Viewed** (yellow dot) — recipient opened the link
  - **Completed** (green dot) — lifecycle complete

### Access Control

| Access Type | Token Used | Description |
|-------------|-----------|-------------|
| Document share link | `share_token` | Anyone with the link can view |
| Per-recipient link | `access_token` | Unique per recipient, tracks individual views |
| Expiry | `expires_at` | Optional — link stops working after this date |

### API Endpoints

| Action | Endpoint | Method |
|--------|----------|--------|
| Share (generate link + add recipients) | `/api/documents/{id}/share` | POST |
| Send document | `/api/documents/{id}/send` | POST |
| List recipients | `/api/documents/{id}/recipients` | GET |
| Remove recipient | `/api/documents/{id}/recipients/{recipientId}` | DELETE |
| Public view | `/api/documents/view/{access_token}` | GET (no auth) |

---

## 11. Export — PDF & DOCX

**Backend**: Export endpoints in `documents.py`

### PDF Export (`GET /{document_id}/pdf`)

- **Library**: `fpdf2`
- **Font**: Helvetica (built-in), Courier for code blocks
- **Page layout**: Auto page breaks, proper margins
- **Block rendering**: Full support for all block types:
  - Headings (4 levels with decreasing font size)
  - Paragraphs with inline styling (bold, italic, code, underline, strikethrough)
  - Bullet and numbered lists with proper indentation
  - Code blocks with slate background shading
  - Tables with header row styling and borders
  - Mermaid diagrams rendered as styled code blocks with a "Diagram" header
  - Blockquotes with left indent and background fill
- **Pricing table**: Rendered as a formatted table with headers, line items, and grand total row
- **Metadata header**: Document title, project name, status, creation date
- **Character safety**: `_safe_text()` handles Unicode → latin-1 conversion with fallback replacements

### DOCX Export (`GET /{document_id}/docx`)

- **Library**: `python-docx`
- **Font**: Inter (custom), Courier New for code blocks
- **Styling**: Full style configuration for Normal, Heading 1–4, List Bullet, List Number
- **Block rendering**: All block types with proper Word styling:
  - Headings with configured fonts, sizes, colors, and spacing
  - Inline styles: bold, italic, code (Courier New + purple), underline, strikethrough
  - List items (bullet and numbered) with proper styles
  - Code blocks with slate background shading via XML shading elements
  - Tables with Table Grid style, header row background, and cell formatting
  - Mermaid diagrams with emoji header, description, and code in a blue-tinted block
  - Quotes/callouts with left indent and subtle background
- **Pricing table**: 6-column table (Item, Qty, Unit Price, Discount, Tax, Total) + grand total row
- **Metadata**: Title heading, project name, status, date, divider line

---

## 12. Live Preview Panel

**Component**: `DocumentPreview.tsx` (384 lines)

### Features

- **Real-time rendering**: BlockNote JSON blocks rendered as beautiful preview HTML
- **Block support**: All block types rendered with tailored styling:
  - Headings with hierarchy-appropriate sizes and colors
  - Paragraphs with proper spacing and line height
  - Bullet/numbered lists with brand-colored bullets
  - Code blocks with dark background, monospace font
  - Tables with header row styling and alternating colors
  - Mermaid diagrams rendered live (via `MermaidDiagram` component)
  - Quotes with brand-accent left border
  - Inline styles: bold, italic, code, underline, strikethrough, links
- **Document header**: Title, project name, team members, date
- **Empty state**: Illustrated prompt with "Use the AI chat to generate content"
- **Dark mode support**: Full dark theme styling for all elements
- **Recursive block rendering**: Children blocks are rendered recursively

---

## 13. Mermaid Diagrams

**Components**: `MermaidBlock.tsx` + `MermaidDiagram.tsx` (106 + 80 lines)

### MermaidBlockSpec (Custom BlockNote Block)

Registered as a custom block type in the BlockNote schema:

```typescript
{
  type: 'mermaid',
  propSchema: { code: { default: '' } },
  content: 'none'
}
```

**Editor behavior**:
- **Empty state**: Dashed border placeholder — "Click to add a Mermaid diagram"
- **View mode**: Renders the diagram live, double-click to switch to edit mode
- **Edit mode**: Full-width textarea for editing Mermaid syntax, "Preview" button to switch back
- **On blur**: Updates the block's `code` prop via `editor.updateBlock()`

### MermaidDiagram (Renderer)

- **Dynamic import**: Mermaid.js loaded client-side only (avoids SSR issues)
- **Configuration**: Neutral theme, Inter font, loose security level, responsive width
- **Error handling**: Renders error state with the raw code + error message
- **Loading state**: Spinning indicator while diagram renders
- **SVG output**: Rendered via `dangerouslySetInnerHTML` for maximum fidelity
- **Caption support**: Optional caption text below the diagram in a styled footer

### Backend Storage Format

```json
{
  "type": "mermaid",
  "props": { "code": "graph TD\n  A[Start] --> B[End]" },
  "content": []
}
```

### Supported Diagram Types

| Type | Syntax | Use Case |
|------|--------|----------|
| Flowchart | `graph TD` or `graph LR` | Workflows, processes |
| Sequence | `sequenceDiagram` | API interactions, message flow |
| Gantt | `gantt` | Project timelines |
| Pie | `pie` | Data distribution |
| Mindmap | `mindmap` | Concept mapping |
| Class | `classDiagram` | System design |
| State | `stateDiagram-v2` | State machines |
| ER | `erDiagram` | Database schemas |

---

## 14. Public Shared Document Viewer

**Component**: `shared/[token]/page.tsx` (287 lines)  
**Route**: `/documents/shared/{token}`

### Features

- **No authentication required** — public access via share token or recipient access token
- **Full document rendering**: All block types rendered with proper styling
  - Headings, paragraphs, lists, code blocks, tables, Mermaid diagrams, blockquotes
- **Pricing table display**: If the document has pricing items, they're rendered as a formatted table with totals
- **Recipient info**: Shows the viewer's name/email and their role
- **Document metadata**: Title, creator name, sent date
- **View tracking**: Automatically updates `viewed_at` on the recipient and document
- **Status update**: If document status is "sent", automatically changes to "viewed" when opened
- **Link expiry**: Returns 410 Gone error if the `expires_at` date has passed
- **Dark mode**: Full dark theme support
- **Loading/error states**: Skeleton loading and styled error messages

---

## 15. Auto-Save System

**Hook**: `useDocumentAutoSave` (custom React hook)  
**Endpoint**: `PUT /api/documents/{id}/content`

### Behavior

- **Debounce**: 2000ms — saves only after the user stops editing for 2 seconds
- **Content format**: Sends the full BlockNote JSON block array
- **Skip mechanism**: `skipNextAutoSaveRef` boolean ref — used to prevent saving immediately after:
  - AI applies content to the document (content is already saved server-side)
  - Version restore (content is already saved server-side)
- **Conflict prevention**: The skip ref ensures no race condition between AI apply and auto-save

### Save Flow

```
User edits in BlockNote
    → onChange fires with new blocks
    → Debounce timer starts (2s)
    → If skipNextAutoSaveRef is true → skip, reset ref
    → Otherwise → PUT /api/documents/{id}/content with { content: blocks }
    → Server stores blocks as JSON in document.content column
```

---

## 16. Backend API Reference

**File**: `backend/app/api/routes/documents.py` (2189 lines)  
**Router prefix**: `/api/documents`

### Complete Endpoint List

| # | Method | Path | Description |
|---|--------|------|-------------|
| 1 | GET | `/session/{session_id}` | List all documents for a project |
| 2 | POST | `/session/{session_id}` | Create document (blank or from template) |
| 3 | GET | `/templates` | List available templates |
| 4 | POST | `/templates` | Save document as template |
| 5 | DELETE | `/templates/{template_id}` | Delete organization template |
| 6 | GET | `/{document_id}` | Get full document with content |
| 7 | PATCH | `/{document_id}` | Update title or status |
| 8 | DELETE | `/{document_id}` | Delete document |
| 9 | POST | `/{document_id}/duplicate` | Clone document + pricing items |
| 10 | PUT | `/{document_id}/content` | Auto-save content (BlockNote JSON) |
| 11 | GET | `/{document_id}/versions` | List version snapshots |
| 12 | POST | `/{document_id}/versions` | Create version snapshot |
| 13 | GET | `/{document_id}/versions/{version_id}` | Get version with content |
| 14 | PATCH | `/{document_id}/versions/{version_id}` | Rename version summary |
| 15 | POST | `/{document_id}/versions/{version_id}/restore` | Restore to version |
| 16 | GET | `/{document_id}/variables` | Resolve template variables |
| 17 | GET | `/session/{session_id}/scope-data` | Get scope tree + cards |
| 18 | GET | `/{document_id}/pricing` | Get pricing line items + totals |
| 19 | POST | `/{document_id}/pricing` | Add pricing line item |
| 20 | PATCH | `/pricing/{item_id}` | Update pricing line item |
| 21 | DELETE | `/pricing/{item_id}` | Delete pricing line item |
| 22 | POST | `/{document_id}/pricing/from-cards` | Import pricing from cards |
| 23 | POST | `/{document_id}/share` | Generate share link + add recipients |
| 24 | POST | `/{document_id}/send` | Send document to recipients |
| 25 | GET | `/{document_id}/recipients` | List recipients with status |
| 26 | DELETE | `/{document_id}/recipients/{recipient_id}` | Remove recipient |
| 27 | GET | `/view/{access_token}` | Public document viewer (no auth) |
| 28 | GET | `/{document_id}/pdf` | Export as PDF download |
| 29 | GET | `/{document_id}/docx` | Export as DOCX download |
| 30 | POST | `/{document_id}/ai/chat` | Send AI chat message |
| 31 | GET | `/{document_id}/ai/history` | Get AI chat history |
| 32 | POST | `/{document_id}/ai/apply` | Apply AI blocks to document |
| 33 | DELETE | `/{document_id}/ai/history` | Clear AI chat history |
| 34 | GET | `/{document_id}/preview` | Get HTML preview |

### Request/Response Schemas

**CreateDocumentRequest**
```json
{ "title": "string (optional)", "template_id": "uuid (optional)" }
```

**UpdateDocumentRequest**
```json
{ "title": "string (optional)", "status": "draft|sent|viewed|completed (optional)" }
```

**SaveContentRequest**
```json
{ "content": [ /* BlockNote JSON blocks */ ] }
```

**AddLineItemRequest**
```json
{
  "name": "string",
  "description": "string (optional)",
  "quantity": 1.0,
  "unit_price": 0.0,
  "discount_percent": 0.0,
  "tax_percent": 0.0,
  "is_optional": false,
  "order_index": 0
}
```

**PricingFromCardsRequest**
```json
{ "hourly_rate": 100.0 }
```

**ShareDocumentRequest**
```json
{
  "recipients": [
    { "name": "string", "email": "string", "role": "viewer|approver" }
  ]
}
```

**AIMessageRequest**
```json
{ "message": "string (1–5000 chars)" }
```

**CreateVersionRequest**
```json
{ "change_summary": "string (optional — auto-generated if omitted)" }
```

### Access Control

- All endpoints (except `/view/{token}`) require authentication via `get_current_user`
- **Session-level access**: User must be a member of the project session
- **Document-level access**: User must be the creator OR in the same organization
- **Delete permission**: Only the creator or an admin can delete documents
- **Template deletion**: Only org members or the template creator; system templates cannot be deleted

---

## 17. AI Service Internals

**File**: `backend/app/services/document_ai_service.py` (1186 lines)

### Key Functions

#### `generate_document_content(db, document_id, user_message, user)`
Main orchestration function:
1. Fetches document from DB
2. Resolves LLM provider (org integration or platform fallback)
3. Builds project context (`_build_project_context`)
4. Formats system prompt with context
5. Loads last 20 chat messages as conversation history
6. Calls LLM (OpenAI or Anthropic)
7. Extracts document content from response markers
8. Converts markdown → BlockNote JSON
9. Saves chat messages (user + assistant) to DB
10. Returns response with blocks and metadata

#### `_build_project_context(db, document)`
Constructs rich context string including:
- Project name and document title/status
- Scope tree (up to 100 nodes with type, status, description preview)
- Team members (name, role, email, hourly rate)
- Planning cards (title, status, estimated hours)
- **Full current document content** as markdown (up to 50,000 chars)

#### `markdown_to_blocknote(md)`
Converts raw markdown to BlockNote-compatible JSON:
- Headings (`#`, `##`, `###`) → heading blocks with level prop
- Bullet lists (`- `, `* `) → bulletListItem blocks
- Numbered lists (`1. `) → numberedListItem blocks
- Code blocks (` ``` `) → codeBlock blocks
- Mermaid blocks (` ```mermaid `) → mermaid blocks with code prop
- Tables (`| col | col |`) → table blocks with tableContent structure
- Inline styles: `**bold**` → `{ styles: { bold: true } }`, etc.
- Default → paragraph blocks

#### `_blocks_to_markdown(blocks)`
Reverse conversion — BlockNote JSON → markdown:
- Used to include the full document content in the AI system prompt
- Handles headings, lists, code blocks, tables, mermaid blocks
- Recurses into children with indentation

#### `apply_blocks_to_document(db, document_id, new_blocks, user, full_replace)`
Two modes:
- **Full replace** (`full_replace=True`): Swaps entire document content — used for AI chat responses
- **Section merge** (`full_replace=False`): Intelligent section-level merging for manual "Insert" actions:
  - Splits new blocks into sections by heading
  - Matches sections to existing headings (case-insensitive)
  - Replaces matched sections, inserts new sections at logical positions
  - Non-headed content appended at end

#### `_extract_document_content(response_text)`
Parses AI response for `---DOCUMENT_START---`/`---DOCUMENT_END---` markers:
- **Markers found**: Returns (chat_text, document_markdown) — content between markers is the document
- **No markers**: Returns (full_text, "") — treated as a chat-only response

### LLM Provider Resolution

```
1. Check user's organization integrations
    → Prefer OpenAI (LLM_OPENAI) if api_key is set
    → Fallback to Anthropic (LLM_ANTHROPIC) if api_key is set
2. Fallback to platform OpenAI key (gpt-4o-mini for cost efficiency)
3. If none available → raise ValueError with settings instructions
```

### LLM Call Parameters

| Parameter | OpenAI | Anthropic |
|-----------|--------|-----------|
| Model | `gpt-4o` (or configured) | `claude-sonnet-4-20250514` (or configured) |
| Temperature | 0.4 | 0.4 |
| Max tokens | 16,000 | 16,000 |
| Timeout | 180 seconds | 180 seconds |

### System Prompt Design

The system prompt instructs the AI to:
1. **Return full document** wrapped in `---DOCUMENT_START---`/`---DOCUMENT_END---` markers for any edit request
2. **Act immediately** — never say "I will" without doing it
3. **Include ALL sections** that should remain (omitting = deleting)
4. **Use project data** — scope tree, team members, cards for real content
5. **Support Mermaid** — generate ` ```mermaid ` blocks for diagram requests
6. **Chat-only** for pure questions (no markers)

---

## 18. File Map

### Frontend

| File | Lines | Description |
|------|-------|-------------|
| `web/src/app/(app)/projects/[id]/documents/page.tsx` | 330 | Main documents page — list/editor router |
| `web/src/components/documents/DocumentEditor.tsx` | 706 | BlockNote editor with side panels |
| `web/src/components/documents/DocumentAIChat.tsx` | 524 | AI chat assistant with prompts |
| `web/src/components/documents/DocumentList.tsx` | 339 | Document grid with status tabs |
| `web/src/components/documents/DocumentPreview.tsx` | 384 | Live HTML preview renderer |
| `web/src/components/documents/TemplateGallery.tsx` | 202 | Template picker modal |
| `web/src/components/documents/PricingTableBlock.tsx` | 482 | Pricing line items manager |
| `web/src/components/documents/DocumentShareModal.tsx` | 331 | Share link + recipients modal |
| `web/src/components/documents/VariableInserter.tsx` | 210 | Template variable browser |
| `web/src/components/documents/MermaidBlock.tsx` | 80 | Custom BlockNote block spec for Mermaid |
| `web/src/components/documents/MermaidDiagram.tsx` | 106 | Mermaid.js SVG renderer |
| `web/src/app/documents/shared/[token]/page.tsx` | 287 | Public shared document viewer |

### Backend

| File | Lines | Description |
|------|-------|-------------|
| `backend/app/api/routes/documents.py` | 2189 | All 34 REST endpoints |
| `backend/app/services/document_ai_service.py` | 1186 | AI content generation, markdown conversion, smart apply |
| `backend/app/services/document_renderer.py` | — | Document rendering utilities |
| `backend/app/services/document_analyzer.py` | — | Document analysis utilities |

---

*Last updated: February 2025*
