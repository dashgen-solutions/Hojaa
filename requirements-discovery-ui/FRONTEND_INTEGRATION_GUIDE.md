# Frontend Integration Guide - Question & Node Management

## ✅ What's Been Added

1. **API Functions** (`src/lib/api.ts`)
   - ✅ Question management functions
   - ✅ Node management functions

2. **New Components**
   - ✅ `QuestionManagement.tsx` - Manage questions
   - ✅ `NodeManagement.tsx` - Manage tree nodes

---

## 🚀 Quick Integration

### Step 1: Update InitialQuestions Component

Add the question management panel to your questions page.

**File:** `src/components/questions/InitialQuestions.tsx`

**Add this import:**
```typescript
import QuestionManagement from "./QuestionManagement";
```

**Add this state:**
```typescript
const [showManagement, setShowManagement] = useState(false);
```

**Add this button before the questions list (around line 124):**
```typescript
{/* Management Toggle */}
<div className="mb-4">
  <button
    onClick={() => setShowManagement(!showManagement)}
    className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-2"
  >
    {showManagement ? "Hide" : "Show"} Question Management
  </button>
</div>

{/* Question Management Panel */}
{showManagement && (
  <div className="mb-6 p-4 bg-secondary-50 rounded-lg border border-secondary-200">
    <h3 className="text-sm font-semibold text-secondary-900 mb-3">
      Manage Questions
    </h3>
    <QuestionManagement
      questions={questions}
      sessionId={sessionId}
      onUpdate={() => {
        // Refresh questions after any change
        const fetchQuestions = async () => {
          const data = await getQuestions(sessionId);
          setQuestions(data.questions || []);
        };
        fetchQuestions();
      }}
    />
  </div>
)}
```

---

### Step 2: Update Tree Visualization

Add node management to your tree nodes.

**Option A: Update Existing TreeNode Component**

**File:** `src/components/tree/TreeNode.tsx`

**Add this import:**
```typescript
import NodeManagement from "./NodeManagement";
```

**Add node management button to each node:**
```typescript
// In your tree node render, add a management button:
<NodeManagement
  node={node}
  sessionId={sessionId}
  allNodes={allNodesFlat} // You'll need to flatten your tree
  onUpdate={onUpdate}
/>
```

**Option B: Create New Enhanced Tree Component**

See the example below for a complete implementation.

---

## 📖 Complete Examples

### Example 1: Enhanced Questions Page

```typescript
"use client";

import { useState, useEffect } from "react";
import { CheckCircleIcon, SparklesIcon } from "@heroicons/react/24/solid";
import { getQuestions, submitAnswers } from "@/lib/api";
import QuestionManagement from "./QuestionManagement";

export default function InitialQuestions({ sessionId, onComplete }) {
  const [questions, setQuestions] = useState([]);
  const [showManagement, setShowManagement] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const fetchQuestions = async () => {
    const data = await getQuestions(sessionId);
    setQuestions(data.questions || []);
  };

  useEffect(() => {
    fetchQuestions();
  }, [sessionId]);

  return (
    <div className="max-w-3xl w-full px-4 md:px-8">
      {/* Header with Management Toggle */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-secondary-900">
            Initial Discovery Questions
          </h2>
          <button
            onClick={() => setShowManagement(!showManagement)}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            {showManagement ? "Hide" : "Manage Questions"}
          </button>
        </div>

        {/* Question Management Panel */}
        {showManagement && (
          <div className="mb-4 p-4 bg-secondary-50 rounded-lg border border-secondary-200">
            <h3 className="text-sm font-semibold text-secondary-900 mb-3">
              Question Management
            </h3>
            <QuestionManagement
              questions={questions}
              sessionId={sessionId}
              onUpdate={fetchQuestions}
            />
          </div>
        )}
      </div>

      {/* Rest of your questions component... */}
    </div>
  );
}
```

---

### Example 2: Enhanced Tree with Node Management

```typescript
"use client";

import { useState } from "react";
import NodeManagement from "./NodeManagement";

interface TreeNodeProps {
  node: any;
  sessionId: string;
  allNodes: any[];
  onUpdate: () => void;
}

function TreeNode({ node, sessionId, allNodes, onUpdate }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 p-3 border border-secondary-200 rounded-lg bg-white hover:border-primary-300">
        {/* Node Content */}
        <div className="flex-1">
          <h3 className="font-medium text-secondary-900">{node.question}</h3>
          {node.answer && (
            <p className="text-sm text-secondary-600 mt-1">{node.answer}</p>
          )}
        </div>

        {/* Node Management */}
        <NodeManagement
          node={node}
          sessionId={sessionId}
          allNodes={allNodes}
          onUpdate={onUpdate}
        />
      </div>

      {/* Children */}
      {node.children && node.children.length > 0 && (
        <div className="ml-6 mt-2">
          {node.children.map((child: any) => (
            <TreeNode
              key={child.id}
              node={child}
              sessionId={sessionId}
              allNodes={allNodes}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function EnhancedTree({ sessionId }) {
  const [tree, setTree] = useState(null);

  const fetchTree = async () => {
    const data = await getTree(sessionId);
    setTree(data.tree);
  };

  useEffect(() => {
    fetchTree();
  }, [sessionId]);

  // Flatten tree for node management
  const flattenTree = (node: any, result: any[] = []): any[] => {
    result.push(node);
    if (node.children) {
      node.children.forEach((child: any) => flattenTree(child, result));
    }
    return result;
  };

  const allNodesFlat = tree ? flattenTree(tree) : [];

  return (
    <div>
      {tree && (
        <TreeNode
          node={tree}
          sessionId={sessionId}
          allNodes={allNodesFlat}
          onUpdate={fetchTree}
        />
      )}
    </div>
  );
}
```

---

## 🎨 Component Features

### QuestionManagement Component

**Features:**
- ✅ Add custom questions
- ✅ Edit question text
- ✅ Edit answers
- ✅ Delete questions
- ✅ Shows question order
- ✅ Marks custom questions

**Props:**
```typescript
interface QuestionManagementProps {
  questions: Question[];      // Array of questions
  sessionId: string;          // Session ID
  onUpdate: () => void;       // Callback after changes
}
```

**Usage:**
```tsx
<QuestionManagement
  questions={questions}
  sessionId={sessionId}
  onUpdate={() => {
    // Refresh questions list
    fetchQuestions();
  }}
/>
```

---

### NodeManagement Component

**Features:**
- ✅ Edit node title and description
- ✅ Add child nodes
- ✅ Move nodes to different parents
- ✅ Delete node (keep or remove children)
- ✅ Dropdown menu interface

**Props:**
```typescript
interface NodeManagementProps {
  node: Node;                 // Current node
  sessionId: string;          // Session ID
  allNodes: Node[];           // All nodes in tree (for move)
  onUpdate: () => void;       // Callback after changes
}
```

**Usage:**
```tsx
<NodeManagement
  node={node}
  sessionId={sessionId}
  allNodes={flattenedNodes}
  onUpdate={() => {
    // Refresh tree
    fetchTree();
  }}
/>
```

---

## 🔧 Helper Functions

### Flatten Tree for Node Management

```typescript
function flattenTree(node: any, result: any[] = []): any[] {
  result.push({
    id: node.id,
    question: node.question,
    answer: node.answer,
    node_type: node.node_type,
    depth: node.depth,
    parent_id: node.parent_id,
  });
  
  if (node.children) {
    node.children.forEach((child: any) => flattenTree(child, result));
  }
  
  return result;
}
```

---

## 🎯 User Workflows

### Workflow 1: Add Custom Question
1. User uploads document → AI generates 10 questions
2. User clicks "Manage Questions"
3. User clicks "Add Custom Question"
4. User enters question text → Clicks "Add"
5. Question appears in list (marked as "Custom")
6. User can answer all questions including custom ones

### Workflow 2: Edit AI Question
1. User sees generated questions
2. Clicks "Manage Questions"
3. Clicks edit icon on a question
4. Edits question text
5. Clicks "Save"
6. Updated question appears in list

### Workflow 3: Add Node to Tree
1. User views requirements tree
2. Clicks "⋮" menu on a node
3. Selects "Add Child"
4. Enters node title and description
5. Clicks "Add Child Node"
6. New node appears under parent

### Workflow 4: Move Node
1. User clicks "⋮" menu on a node
2. Selects "Move Node"
3. Selects new parent from dropdown
4. Clicks "Move Node"
5. Node appears under new parent with updated depth

---

## 🎨 Styling

Both components use your existing Tailwind classes:
- `primary-*` colors for main actions
- `secondary-*` colors for neutral elements
- `success-*` colors for positive actions
- `red-*` colors for delete actions

The components will match your existing design automatically!

---

## 🧪 Testing

### Test Question Management

1. Upload a document
2. Wait for questions to generate
3. Click "Manage Questions"
4. Try adding a question
5. Try editing a question
6. Try deleting a question
7. Submit answers
8. Verify tree is generated correctly

### Test Node Management

1. Generate a tree
2. Click "⋮" on any node
3. Try adding a child node
4. Try editing a node
5. Try moving a node
6. Try deleting (both options)
7. Verify tree updates correctly

---

## 📝 Installation Steps

1. **API functions already added** ✅
2. **Components already created** ✅
3. **Next steps:**
   - Integrate `QuestionManagement` into your questions page
   - Integrate `NodeManagement` into your tree components
   - Test all features
   - Adjust styling if needed

---

## 🆘 Troubleshooting

### Questions not updating after edit
```typescript
// Make sure onUpdate callback refreshes the list:
onUpdate={() => {
  const fetchQuestions = async () => {
    const data = await getQuestions(sessionId);
    setQuestions(data.questions || []);
  };
  fetchQuestions();
}}
```

### Tree not updating after node change
```typescript
// Make sure onUpdate callback refreshes the tree:
onUpdate={() => {
  const fetchTree = async () => {
    const data = await getTree(sessionId);
    setTree(data.tree);
  };
  fetchTree();
}}
```

### "allNodes" not defined
```typescript
// Flatten your tree first:
const flattenTree = (node, result = []) => {
  result.push(node);
  if (node.children) {
    node.children.forEach(child => flattenTree(child, result));
  }
  return result;
};

const allNodesFlat = tree ? flattenTree(tree) : [];
```

---

## ✅ Summary

You now have:
- ✅ Question management UI ready
- ✅ Node management UI ready
- ✅ API functions integrated
- ✅ Ready to integrate into your pages

**Just add the components to your existing pages and you're done!** 🚀

---

**Need help?** Check the complete examples above or refer to the component source code.
