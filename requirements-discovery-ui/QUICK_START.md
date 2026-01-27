# 🚀 Quick Start - New Features

## ✅ What's New

Your MoMetric frontend now has **full question and node management** integrated!

---

## 🎯 New Features Overview

### 1. Question Management (Initial Questions Page)

**Location:** When you upload a document and see the 10 generated questions

**New Features:**
- ➕ **Add Custom Questions** - Button at top of questions list
- ✏️ **Edit Questions** - Pencil icon next to each question
- 🗑️ **Delete Questions** - Trash icon next to each question

**Try it:**
```
1. Upload a document
2. Wait for 10 questions to generate
3. Click [+ Add Custom Question] at the top
4. Type "What is your budget?" → Click Add
5. Your custom question appears with [Custom] badge
6. Click ✏️ to edit any question
7. Click 🗑️ to delete any question
```

---

### 2. Node Management (Requirements Tree)

**Location:** After answering questions and generating the tree

**New Features:**
- ⋮ **Menu Button** - On every non-root node
- ✏️ **Edit Node** - Change title and description
- ➕ **Add Child Node** - Add sub-requirements manually
- 🗑️ **Delete Node** - Two options: keep or remove children

**Try it:**
```
1. Generate a requirements tree
2. Find any feature or requirement node
3. Click the ⋮ menu button (top right of node card)
4. Choose an action:
   - Edit Node
   - Add Child
   - Delete (Keep Children)
   - Delete (With Children)
```

---

## 🎨 Visual Guide

### Questions Page - What You'll See

```
┌─────────────────────────────────────────────────────┐
│  Initial Discovery Questions              3 / 10    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                 │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐  ← NEW!
│      [+ Add Custom Question]                        │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ ✅  1. What is the main goal?            [✏️] [🗑️]  │  ← NEW!
│      ┌────────────────────────────────┐             │
│      │ Build a requirements tool      │             │
│      └────────────────────────────────┘             │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ ⭕  2. Who are your users?              [✏️] [🗑️]  │  ← NEW!
│      ┌────────────────────────────────┐             │
│      │ [Type your answer...]          │             │
│      └────────────────────────────────┘             │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ ⭕  3. What is your budget? [Custom]    [✏️] [🗑️]  │  ← NEW! Custom question
│      ┌────────────────────────────────┐             │
│      │ [Type your answer...]          │             │
│      └────────────────────────────────┘             │
└─────────────────────────────────────────────────────┘
```

---

### Tree Node - What You'll See

**Before (without menu):**
```
┌──────────────────────────────────┐
│ Feature                          │
│ ────────────────────────────     │
│ User Authentication              │
│                                  │
│ [+ Explore]            [▼]      │
└──────────────────────────────────┘
```

**After (with menu):**
```
┌──────────────────────────────────┐
│ Feature                     [⋮]  │  ← NEW! Click this
│ ────────────────────────────     │
│ User Authentication              │
│                                  │
│ [+ Explore]            [▼]      │
└──────────────────────────────────┘
         ↓ Click ⋮ shows:
    ┌──────────────────────┐
    │ ✏️ Edit Node        │
    │ ➕ Add Child        │
    │ ─────────────────── │
    │ 🗑️ Delete (Keep)   │
    │ 🗑️ Delete (All)    │
    └──────────────────────┘
```

---

## 🎬 User Workflows

### Add a Custom Question

```
Step 1: Upload document
  ↓
Step 2: AI generates 10 questions
  ↓
Step 3: Click [+ Add Custom Question]
  ↓
Step 4: Type: "What is your timeline?"
  ↓
Step 5: Click [Add Question]
  ↓
Step 6: Question appears with [Custom] badge
  ↓
Step 7: Answer all 11 questions (10 AI + 1 custom)
  ↓
Step 8: Generate tree
  ✓ Your custom question is included!
```

---

### Edit a Question

```
Step 1: See generated questions
  ↓
Step 2: Click ✏️ pencil icon on a question
  ↓
Step 3: Edit the question text
  ↓
Step 4: Click [Save]
  ↓
Step 5: Question updates immediately
  ✓ Your edits are saved!
```

---

### Add a Child Node to Tree

```
Step 1: View your requirements tree
  ↓
Step 2: Find the parent node
  ↓
Step 3: Click ⋮ menu
  ↓
Step 4: Select [Add Child]
  ↓
Step 5: Form appears where the node was
  ┌───────────────────────────────┐
  │ New Child Node Title          │
  │ [Security Features___]        │
  │                               │
  │ Description (optional)        │
  │ [OAuth and JWT authentication]│
  │                               │
  │ [Add Child]  [Cancel]         │
  └───────────────────────────────┘
  ↓
Step 6: Click [Add Child]
  ↓
Step 7: Tree refreshes
  ✓ New node appears as child!
```

---

### Delete a Node

```
Step 1: Click ⋮ on a node
  ↓
Step 2: Choose delete option:
  
  Option A: [Delete (Keep Children)]
    → Node removed
    → Children move up to grandparent
    → Tree structure preserved
  
  Option B: [Delete (With Children)]
    → Node + all descendants removed
    → Branch completely deleted
    → Use with caution!
  ↓
Step 3: Confirm action
  ↓
Step 4: Tree refreshes
  ✓ Changes applied!
```

---

## 🧪 Testing Instructions

### Test 1: Add & Edit Questions (5 minutes)

1. Start frontend: `npm run dev`
2. Upload a sample document
3. Wait for 10 questions
4. Click "Add Custom Question"
5. Add: "What is your deadline?"
6. Verify it appears with [Custom] badge
7. Click ✏️ on question 1
8. Change the text
9. Click Save
10. Verify it updates

**Expected:** ✅ Questions can be added and edited

---

### Test 2: Delete Questions (2 minutes)

1. Click 🗑️ on any question
2. Confirm deletion
3. Verify question removed
4. Verify remaining questions reordered

**Expected:** ✅ Questions can be deleted

---

### Test 3: Edit Tree Nodes (5 minutes)

1. Generate a tree
2. Click ⋮ on a feature node
3. Select "Edit Node"
4. Change title to "New Title"
5. Add description: "This is updated"
6. Click Save
7. Verify tree refreshes
8. Verify node shows new data

**Expected:** ✅ Nodes can be edited

---

### Test 4: Add Child Nodes (5 minutes)

1. Click ⋮ on any node
2. Select "Add Child"
3. Enter title: "Test Child"
4. Enter description: "Test description"
5. Click Add Child
6. Verify tree refreshes
7. Verify new child appears

**Expected:** ✅ Child nodes can be added

---

### Test 5: Delete Nodes (5 minutes)

**Test A: Delete (Keep Children)**
1. Find a node with children
2. Click ⋮
3. Select "Delete (Keep Children)"
4. Confirm
5. Verify children move up

**Test B: Delete (With Children)**
1. Find a node with children
2. Click ⋮
3. Select "Delete (With Children)"
4. Confirm
5. Verify entire branch removed

**Expected:** ✅ Both delete options work

---

## ⚙️ Start Your Dev Server

```bash
cd requirements-discovery-ui
npm run dev
```

Visit: http://localhost:3000

Backend should be running at: http://localhost:8000

---

## ✅ Summary

**What's Integrated:**
- ✅ Question add/edit/delete in InitialQuestions
- ✅ Node edit/add/delete in Tree
- ✅ All features inline - no separate pages
- ✅ Auto-refresh after changes
- ✅ User-friendly confirmations
- ✅ Error handling

**How to Use:**
1. Start dev server
2. Upload document
3. Try question features
4. Generate tree
5. Try node features

**Everything is ready to use!** 🎉

---

## 🆘 Troubleshooting

### Questions not adding?
- Check backend is running: http://localhost:8000/api/docs
- Check browser console for errors
- Verify session ID is valid

### Tree not updating?
- Check browser console
- Verify backend API is responding
- Try hard refresh (Ctrl+Shift+R)

### Icons not showing?
- Verify heroicons package installed
- Check import statements
- Restart dev server

---

**Need help?** Check `FULLY_INTEGRATED_FEATURES.md` for detailed technical docs.
