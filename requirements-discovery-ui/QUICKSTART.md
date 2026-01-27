# Quick Start Guide

## 🚀 Get Running in 5 Minutes

### Step 1: Install Dependencies

```bash
cd requirements-discovery-ui
npm install
```

### Step 2: Run Development Server

```bash
npm run dev
```

### Step 3: Open in Browser

Visit: **http://localhost:3000**

You should see:
- ✅ Header with MoMetric logo
- ✅ Sidebar with "New Discovery" button
- ✅ Tree visualization (left side)
- ✅ Chat interface (right side)

## 💬 Try the Interface

### 1. Start a Conversation

In the chat interface, you'll see:
```
"Hello! I'm here to help you discover your requirements. 
What kind of product would you like to build?"
```

Click a suggestion or type your own answer:
- "A customer support chatbot"
- "An e-commerce platform"
- "A mobile app for tracking tasks"

### 2. Watch the Tree Grow

As you answer questions:
- New nodes appear in the tree (left side)
- Each node shows the question and your answer
- Click nodes to expand/collapse children
- Color-coded: Root (blue), Feature (yellow), Detail (green)

### 3. Navigate the Interface

**Sidebar:**
- "New Discovery" - Start a new session
- Recent sessions - View past conversations

**Tree View:**
- Click any node to expand/collapse
- See the full conversation flow
- Legend at the bottom shows node types

**Chat:**
- Type or click suggestions
- AI asks follow-up questions
- Messages appear instantly

## 🎨 UI Components Explained

### Header
```
┌─────────────────────────────────────────┐
│ 🔷 MoMetric / Requirements Discovery    │
│                              ⚙️ Settings │
└─────────────────────────────────────────┘
```

### Main Layout
```
┌─────────────┬───────────────────────────┐
│             │                           │
│  Sidebar    │    Tree   │     Chat     │
│  Sessions   │    View   │  Interface   │
│             │           │               │
└─────────────┴───────────┴───────────────┘
```

### Tree Node Example
```
🔵 Root Question
├─ What kind of product would you like to build?
│  └─ Answer: "A customer support chatbot"
│
└─ 🟡 Feature Question
   ├─ What's the main purpose?
   │  └─ Answer: "Handle customer inquiries"
   │
   └─ 🟢 Detail Question
      └─ What types of questions should it answer?
```

## 🔧 Customization

### Change Primary Color

Edit `tailwind.config.ts`:

```typescript
colors: {
  primary: {
    ...colors.blue,  // Change from indigo
  },
}
```

### Modify Initial Question

Edit `src/components/chat/ChatInterface.tsx`:

```typescript
const [messages, setMessages] = useState<Message[]>([
  {
    id: "1",
    role: "assistant",
    content: "Your custom first question here",
    timestamp: new Date(),
  },
]);
```

### Add More Suggestions

Edit `src/components/chat/ChatInterface.tsx`:

```typescript
const [suggestions, setSuggestions] = useState([
  "Your suggestion 1",
  "Your suggestion 2",
  "Your suggestion 3",
]);
```

## 🔌 Connect to Backend

Currently using mock data. To connect to FastAPI:

### 1. Update API Route

Edit `src/app/api/chat/route.ts`:

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json();
  
  const response = await fetch('http://localhost:8000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: body.message,
      conversationId: body.conversationId,
    }),
  });
  
  const data = await response.json();
  return NextResponse.json(data);
}
```

### 2. Update Chat Interface

Edit `src/components/chat/ChatInterface.tsx`:

```typescript
const handleSendMessage = async (content: string) => {
  // Add user message
  const userMessage: Message = {
    id: Date.now().toString(),
    role: "user",
    content: content.trim(),
    timestamp: new Date(),
  };
  
  setMessages((prev) => [...prev, userMessage]);
  setIsLoading(true);

  // Call API
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: content,
      conversationId: 'current-session-id',
    }),
  });

  const data = await response.json();
  
  const assistantMessage: Message = {
    id: (Date.now() + 1).toString(),
    role: "assistant",
    content: data.data.response,
    timestamp: new Date(),
  };

  setMessages((prev) => [...prev, assistantMessage]);
  setSuggestions(data.data.suggestions || []);
  setIsLoading(false);
};
```

## 📊 Expected Backend Response Format

Your FastAPI backend should return:

```json
{
  "success": true,
  "data": {
    "response": "AI's next question here",
    "nextQuestion": "What features would you like?",
    "suggestions": [
      "Feature 1",
      "Feature 2",
      "Feature 3"
    ],
    "nodeId": "unique-node-id",
    "nodeType": "feature",
    "depth": 2
  }
}
```

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3000
npx kill-port 3000

# Or use different port
npm run dev -- -p 3001
```

### Styling Not Working

```bash
# Rebuild Tailwind
rm -rf .next
npm run dev
```

### API Not Connecting

1. Check FastAPI is running: `http://localhost:8000`
2. Check CORS settings in FastAPI
3. Verify API route in browser: `http://localhost:3000/api/chat`

## 📱 Mobile View

Currently optimized for desktop (1024px+). Mobile responsive design is in TODO.

## ⌨️ Keyboard Shortcuts

- `Enter` - Send message
- `Shift + Enter` - New line in message
- Click node - Expand/collapse

## 🎯 Next Steps

1. **Connect to Backend**: Follow "Connect to Backend" section
2. **Test with Real Data**: Replace mock tree data
3. **Add Persistence**: Save sessions to database
4. **Customize Branding**: Update colors, logo, text

## 📚 More Resources

- [Full README](./README.md)
- [Specifai GitHub](https://github.com/presidio-oss/specif-ai)
- [Next.js Docs](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

**Need help? Check the main README or create an issue.**
