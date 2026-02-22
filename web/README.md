# MoMetric Requirements Discovery UI

A web-based interface for AI-powered requirements discovery through progressive questioning. Built with **Next.js**, **TypeScript**, and **Tailwind CSS**, inspired by [Specifai](https://github.com/presidio-oss/specif-ai)'s design system.

## 🎨 Features

- **Tree-Based Visualization**: See the entire conversation flow as an interactive tree
- **Progressive AI Questioning**: AI asks granular questions one-by-one based on your answers
- **Branching Logic**: Each answer can spawn multiple paths/features to explore
- **Real-time Chat Interface**: Clean, modern chat UI inspired by Specifai
- **Session Management**: Save and resume discovery sessions
- **Specifai Color Scheme**: Indigo primary, Slate secondary, professional design

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. **Install dependencies:**

```bash
cd requirements-discovery-ui
npm install
```

2. **Run the development server:**

```bash
npm run dev
```

3. **Open in browser:**

Navigate to [http://localhost:3000](http://localhost:3000)

## 🎨 Design System

This UI uses the same color palette as Specifai:

- **Primary**: Indigo (`indigo-50` to `indigo-900`)
- **Secondary**: Slate (`slate-50` to `slate-900`)
- **Success**: Emerald
- **Danger**: Red
- **Warning**: Amber
- **Font**: Geist (variable font)

## 📁 Project Structure

```
requirements-discovery-ui/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── chat/
│   │   │       └── route.ts          # API routes
│   │   ├── globals.css               # Global styles
│   │   ├── layout.tsx                # Root layout
│   │   └── page.tsx                  # Home page
│   └── components/
│       ├── layout/
│       │   ├── Header.tsx            # App header
│       │   └── Sidebar.tsx           # Session sidebar
│       ├── tree/
│       │   ├── TreeVisualization.tsx # Tree view
│       │   └── TreeNode.tsx          # Individual node
│       └── chat/
│           ├── ChatInterface.tsx     # Chat UI
│           ├── ChatMessage.tsx       # Message component
│           └── LoadingDots.tsx       # Loading indicator
├── package.json
├── tailwind.config.ts                # Tailwind config (Specifai colors)
└── tsconfig.json
```

## 🔧 Configuration

### Connecting to FastAPI Backend

Replace the mock API in `src/app/api/chat/route.ts` with your FastAPI backend:

```typescript
// src/app/api/chat/route.ts
export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // Call your FastAPI backend
  const response = await fetch('http://localhost:8000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  
  const data = await response.json();
  return NextResponse.json(data);
}
```

### Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
OPENAI_API_KEY=your_key_here
```

## 🧩 Key Components

### TreeVisualization

Displays the conversation as an expandable tree with:
- Color-coded nodes (root, feature, detail)
- Expand/collapse functionality
- Visual question flow

### ChatInterface

AI chat interface with:
- User and assistant messages
- Suggestion chips
- Loading states
- Auto-scroll

### TreeNode

Individual node in the tree showing:
- Question text
- User's answer
- Number of child questions
- Visual indicators

## 📊 Data Flow

```
User Input
    ↓
Chat Interface
    ↓
API Route (Next.js)
    ↓
FastAPI Backend (TODO: Connect)
    ↓
LangGraph Question Generator
    ↓
PostgreSQL (Store tree)
    ↓
Response to Frontend
    ↓
Update Tree + Chat
```

## 🎯 Next Steps

### Frontend (Current)
- ✅ Basic UI structure
- ✅ Chat interface
- ✅ Tree visualization
- ⏳ Connect to real backend API
- ⏳ Add state management (Zustand)
- ⏳ Persist conversations
- ⏳ Export functionality

### Backend (To Build)
- FastAPI server
- LangGraph workflow
- PostgreSQL database
- OpenAI/Claude integration
- Question generation logic

## 🛠 Development

### Build for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## 🎨 Customization

### Change Colors

Edit `tailwind.config.ts`:

```typescript
colors: {
  primary: {
    ...colors.blue,  // Change from indigo to blue
  },
}
```

### Add New Node Types

In `TreeVisualization.tsx`, add to the `type` field:

```typescript
type: "root" | "feature" | "detail" | "your-new-type"
```

## 📝 TODO

- [ ] Connect to FastAPI backend
- [ ] Add authentication
- [ ] Implement session persistence
- [ ] Add export to PDF/JSON
- [ ] Add mobile responsive design
- [ ] Add dark mode
- [ ] Integrate with Scope Canvas module

## 📄 License

MIT

## 🙏 Credits

- UI Design inspired by [Specifai](https://github.com/presidio-oss/specif-ai)
- Icons from [Heroicons](https://heroicons.com/)
- Built with [Next.js](https://nextjs.org/)

---

**For questions or issues, please contact the MoMetric team.**
