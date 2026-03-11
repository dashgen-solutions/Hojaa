# New Functions & Implementations — Feature Documentation

> All UI fixes, backend improvements, and architectural changes implemented across the Hojaa platform.

---

## Table of Contents

1. [ChatInterface Header Visibility Fix](#1-chatinterface-header-visibility-fix)
2. [Discovery Page Overflow Fix](#2-discovery-page-overflow-fix)
3. [ResizableSplitPane Height Fix](#3-resizablesplitpane-height-fix)
4. [App Layout Flex Chain Fix](#4-app-layout-flex-chain-fix)
5. [Tree Node Outside-Click Dismiss](#5-tree-node-outside-click-dismiss)
6. [Deep Tree Generation (Recursive FeatureNode)](#6-deep-tree-generation-recursive-featurenode)
7. [AI Usage Limit Enforcement Audit](#7-ai-usage-limit-enforcement-audit)
8. [SessionChatbot Responsive Sizing](#8-sessionchatbot-responsive-sizing)

---

## 1. ChatInterface Header Visibility Fix

**File:** `web/src/components/chat/ChatInterface.tsx`

### Problem
The chat header (containing the "Approve" button and node title) was being pushed out of view when messages loaded. The `scrollIntoView()` call on new messages was scrolling the `overflow-hidden` parent container instead of just the messages area.

### Root Cause
`scrollIntoView()` scrolls the **nearest scrollable ancestor**, and since the parent had `overflow: hidden` (which is technically scrollable programmatically), the entire panel shifted up.

### Changes

1. **Added `messagesContainerRef`** — a ref targeting the scrollable messages container specifically.

2. **Replaced `scrollIntoView()` with direct `scrollTop` assignment:**
   ```typescript
   // Before (broken)
   messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

   // After (fixed)
   const container = messagesContainerRef.current;
   if (container) {
     container.scrollTop = container.scrollHeight;
   }
   ```

3. **Changed root container from `overflow-hidden` to `overflow: clip`:**
   ```tsx
   // Before
   <div className="... overflow-hidden">

   // After
   <div className="..." style={{ overflow: 'clip' }}>
   ```

### Why `overflow: clip` vs `overflow: hidden`
- `overflow: hidden` creates a scroll container that can be scrolled programmatically
- `overflow: clip` truly clips content without creating a scrollable box — no JavaScript can scroll it
- This prevents any rogue `scrollIntoView()` from shifting the container

---

## 2. Discovery Page Overflow Fix

**File:** `web/src/app/(app)/projects/[id]/discovery/page.tsx`

### Change
Right panel wrapper changed from class-based overflow to style-based clip:

```tsx
// Before
<div className="h-full flex flex-col ... overflow-hidden">

// After
<div className="h-full ..." style={{ overflow: 'clip' }}>
```

This ensures the node chatbot inside the right panel cannot shift the panel itself when scrolling messages.

---

## 3. ResizableSplitPane Height Fix

**File:** `web/src/components/layout/ResizableSplitPane.tsx`

### Change
Added `h-full` class to both the left and right panel containers within the split pane, ensuring the panels fill the available vertical space in the flexbox layout chain.

---

## 4. App Layout Flex Chain Fix

**File:** `web/src/app/(app)/layout.tsx`

### Change
Added `min-h-0` to the `<main>` element:

```tsx
<main className="flex-1 min-h-0 overflow-hidden">
```

### Why
In a flexbox column layout, children default to `min-height: auto`, which prevents them from shrinking below their content size. Adding `min-h-0` allows the main content area to shrink properly, enabling nested flex children (like the discovery page split pane) to fit within the viewport height.

---

## 5. Tree Node Outside-Click Dismiss

**File:** `web/src/components/tree/RelationshipTreeNode.tsx`

### Problem
The 3-dot menu, status dropdown, and assign dropdown on tree nodes did not close when clicking outside of them.

### Implementation

1. **Added `nodeRef`** (`useRef<HTMLDivElement>`) attached to the node card container.

2. **Added `useEffect` for outside click detection:**
   ```typescript
   useEffect(() => {
     if (!showMenu && !showStatusDropdown && !showAssignDropdown) return;

     const handleClickOutside = (e: MouseEvent) => {
       if (nodeRef.current && !nodeRef.current.contains(e.target as Node)) {
         setShowMenu(false);
         setShowStatusDropdown(false);
         setShowAssignDropdown(false);
         setPendingStatus(null);
         setDeferredReason('');
       }
     };

     const handleEscape = (e: KeyboardEvent) => {
       if (e.key === 'Escape') { /* close all */ }
     };

     // Delayed addEventListener prevents the opening click from immediately closing
     const timer = setTimeout(() => {
       document.addEventListener('mousedown', handleClickOutside);
     }, 0);
     document.addEventListener('keydown', handleEscape);

     return () => {
       clearTimeout(timer);
       document.removeEventListener('mousedown', handleClickOutside);
       document.removeEventListener('keydown', handleEscape);
     };
   }, [showMenu, showStatusDropdown, showAssignDropdown]);
   ```

### Key Detail
The `setTimeout(..., 0)` wrapper for the mousedown listener ensures the click event that opened the menu has finished propagating before the outside-click listener activates.

---

## 6. Deep Tree Generation (Recursive FeatureNode)

### Backend Model: `agent_models.py`

**File:** `backend/app/models/agent_models.py`

### Problem
The AI was generating flat, single-level trees. Feature nodes could not have children of their own.

### Changes

1. **Made `FeatureNode` self-referencing:**
   ```python
   class FeatureNode(BaseModel):
       question: str
       answer: str
       node_type: str = "feature"
       children: List["FeatureNode"] = []

   FeatureNode.model_rebuild()  # Required for Pydantic self-referencing
   ```

2. **Added `node_type` field** — allows the AI to differentiate between "feature", "sub-feature", "detail", etc.

3. **Called `model_rebuild()`** — necessary for Pydantic v2 to resolve forward references in recursive models.

### Backend Service: `tree_builder.py`

**File:** `backend/app/services/tree_builder.py`

1. **New `_create_nodes_recursive()` function** — recursively traverses the AI output and creates database nodes at each depth level:
   ```python
   async def _create_nodes_recursive(db, session_id, parent_id, nodes, depth=0):
       for node_data in nodes:
           db_node = create_node(session_id, parent_id, node_data)
           if node_data.children:
               await _create_nodes_recursive(db, session_id, db_node.id, node_data.children, depth+1)
   ```

2. **Updated AI prompts** — instruct the model to generate 2–4 level deep trees with meaningful hierarchy (features → sub-features → details).

---

## 7. AI Usage Limit Enforcement Audit

**File:** `backend/app/api/routes/planning.py`

### Context
The platform enforces a **$0.10 free-tier AI usage limit** via `enforce_ai_limit()` which is called inside `cached_agent_run()`. All 14 LLM call sites were audited.

### Gap Found
The `POST /planning/cards/{card_id}/generate-ac` endpoint was missing the `current_user` dependency, meaning it couldn't enforce per-user AI limits.

### Fix
```python
# Before
@router.post("/cards/{card_id}/generate-ac")
async def generate_acceptance_criteria(card_id: str, db: Session = Depends(get_db)):
    # No user context — limit not enforced

# After
@router.post("/cards/{card_id}/generate-ac")
async def generate_acceptance_criteria(
    card_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user),  # Added
):
    # Now passes user_id to AI call → limit enforced
    result = await generate_ac(db, card_id, user_id=current_user.id if current_user else None)
```

### All 14 Audited Call Sites

| # | Endpoint / Service | Limit Enforced? |
|---|-------------------|-----------------|
| 1 | `POST /discovery/chat/send` | ✅ via `cached_agent_run()` |
| 2 | `POST /discovery/generate-tree` | ✅ via `cached_agent_run()` |
| 3 | `POST /discovery/auto-answer` | ✅ via `cached_agent_run()` |
| 4 | `POST /discovery/expand-node` | ✅ via `cached_agent_run()` |
| 5 | `POST /discovery/sessions/{id}/chatbot` | ✅ via `cached_agent_run()` |
| 6 | `POST /documents/{id}/chat` | ✅ via `cached_agent_run()` |
| 7 | `POST /documents/{id}/analyze` | ✅ via `cached_agent_run()` |
| 8 | `POST /documents/{id}/extract-requirements` | ✅ via `cached_agent_run()` |
| 9 | `POST /planning/boards/{id}/suggest` | ✅ via `cached_agent_run()` |
| 10 | `POST /planning/cards/{id}/generate-ac` | ✅ **Fixed** (added auth dependency) |
| 11 | `POST /planning/cards/{id}/breakdown` | ✅ via `cached_agent_run()` |
| 12 | `POST /roadmap/generate` | ✅ via `cached_agent_run()` |
| 13 | `POST /roadmap/feedback` | ✅ via `cached_agent_run()` |
| 14 | `POST /messaging-chat/send` | ✅ via `enforce_ai_limit()` in service |

---

## 8. SessionChatbot Responsive Sizing

**File:** `web/src/components/chat/SessionChatbot.tsx`

### Change
Changed from fixed dimensions to responsive sizing:

```tsx
// Before
style={{ maxHeight: '500px', width: '380px' }}

// After
style={{ maxHeight: 'calc(100vh - 5rem)' }}
// + responsive width via className
```

This ensures the project-level floating chatbot fits within the viewport on all screen sizes and doesn't overflow on smaller displays.

---

## Summary of Files Modified

### Frontend

| File | Changes |
|------|---------|
| `web/src/components/chat/ChatInterface.tsx` | `messagesContainerRef`, `scrollTop` scroll, `overflow: clip` |
| `web/src/components/chat/SessionChatbot.tsx` | Responsive max-height and width |
| `web/src/components/tree/RelationshipTreeNode.tsx` | `nodeRef`, outside-click/Escape dismiss |
| `web/src/components/layout/ResizableSplitPane.tsx` | `h-full` on panel containers |
| `web/src/app/(app)/layout.tsx` | `min-h-0` on `<main>` |
| `web/src/app/(app)/projects/[id]/discovery/page.tsx` | `overflow: clip` on right panel |

### Backend

| File | Changes |
|------|---------|
| `backend/app/models/agent_models.py` | Recursive `FeatureNode` with `model_rebuild()` |
| `backend/app/services/tree_builder.py` | `_create_nodes_recursive()`, updated prompts |
| `backend/app/api/routes/planning.py` | Added `get_optional_user` dependency to generate-ac |
