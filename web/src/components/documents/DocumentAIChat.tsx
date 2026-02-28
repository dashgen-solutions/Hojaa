'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  SparklesIcon,
  PaperAirplaneIcon,
  TrashIcon,
  DocumentArrowDownIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import {
  sendDocumentAIMessage,
  getDocumentAIHistory,
  clearDocumentAIHistory,
  type DocumentAIChatMessage,
  type DocumentAIChatResponse,
} from '@/lib/api';

interface DocumentAIChatProps {
  documentId: string;
  sessionId: string;
  onInsertBlocks: (blocks: any[]) => void;
}

const QUICK_PROMPTS = [
  { label: 'Generate a project proposal', prompt: 'Generate a project proposal' },
  { label: 'Write an executive summary', prompt: 'Write an executive summary' },
  { label: 'Create a scope of work', prompt: 'Create a scope of work' },
  { label: 'Draft a pricing section', prompt: 'Draft a pricing section' },
  { label: 'Summarize the project scope', prompt: 'Summarize the project scope' },
];

export default function DocumentAIChat({
  documentId,
  sessionId,
  onInsertBlocks,
}: DocumentAIChatProps) {
  const [messages, setMessages] = useState<DocumentAIChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerError, setProviderError] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load chat history on mount
  useEffect(() => {
    loadHistory();
  }, [documentId]);

  // Auto-scroll to bottom on new messages or loading state change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const data = await getDocumentAIHistory(documentId);
      setMessages(data || []);
    } catch {
      // Silent failure — history may not exist yet
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const sendMessage = useCallback(
    async (text?: string) => {
      const msg = text || input.trim();
      if (!msg || isLoading) return;

      setInput('');
      setError(null);
      setProviderError(false);

      // Optimistically add user message
      const userMsg: DocumentAIChatMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: msg,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const response: DocumentAIChatResponse = await sendDocumentAIMessage(
          documentId,
          msg,
        );

        const assistantMsg: DocumentAIChatMessage = {
          id: response.message_id,
          role: 'assistant',
          content: response.response,
          generated_blocks: response.blocks,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 400) {
          setProviderError(true);
        } else {
          setError('Failed to get a response. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, documentId],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearDocumentAIHistory(documentId);
      setMessages([]);
      setError(null);
      setProviderError(false);
    } catch {
      // silent
    }
  };

  const showQuickPrompts = messages.length === 0 && !isLoadingHistory;

  return (
    <div className="flex flex-col h-full">
      {/* Clear chat button */}
      {messages.length > 0 && (
        <div className="flex justify-end px-3 pt-2">
          <button
            onClick={handleClearHistory}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
            title="Clear chat history"
          >
            <TrashIcon className="w-3.5 h-3.5" />
            Clear chat
          </button>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {isLoadingHistory ? (
          <div className="flex items-center justify-center py-10">
            <ArrowPathIcon className="w-5 h-5 text-neutral-400 animate-spin" />
          </div>
        ) : showQuickPrompts ? (
          <div className="py-4">
            <div className="flex flex-col items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center mb-2">
                <SparklesIcon className="w-5 h-5 text-indigo-500" />
              </div>
              <h4 className="text-sm font-semibold text-neutral-800">
                AI Document Assistant
              </h4>
              <p className="text-xs text-neutral-500 text-center mt-1 max-w-[260px]">
                Generate content for your document with AI. Try a prompt below
                or type your own.
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium">
                Quick prompts
              </p>
              {QUICK_PROMPTS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => sendMessage(action.prompt)}
                  className="w-full text-left px-3 py-2 rounded-md border border-neutral-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors text-xs text-neutral-700"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Message list */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[90%] rounded-md px-3 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-100 text-neutral-800'
              }`}
            >
              {msg.role === 'assistant' ? (
                <MarkdownRenderer content={msg.content} />
              ) : (
                <span>{msg.content}</span>
              )}

              {/* Insert into Document button */}
              {msg.role === 'assistant' &&
                msg.generated_blocks &&
                msg.generated_blocks.length > 0 && (
                  <button
                    onClick={() => onInsertBlocks(msg.generated_blocks!)}
                    className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md text-xs font-medium px-3 py-1.5 mt-2 transition-colors"
                  >
                    <DocumentArrowDownIcon className="w-3.5 h-3.5" />
                    Insert into Document
                  </button>
                )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-neutral-100 rounded-md px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div
                    className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <div
                    className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <div
                    className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
                <span className="text-xs text-neutral-500">Generating...</span>
              </div>
            </div>
          </div>
        )}

        {/* Provider not configured error */}
        {providerError && (
          <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2.5 text-xs text-red-600">
            Set up your AI provider in{' '}
            <Link
              href="/settings"
              className="underline font-medium hover:text-red-700"
            >
              Settings &gt; AI
            </Link>{' '}
            to start generating documents.
          </div>
        )}

        {/* Generic error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-neutral-200 px-3 py-2.5">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what to generate..."
            rows={1}
            className="flex-1 resize-none rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-400 focus:ring-1 focus:ring-neutral-200 outline-none placeholder:text-neutral-400 max-h-24 overflow-y-auto"
            style={{ minHeight: '38px' }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = '38px';
              t.style.height = Math.min(t.scrollHeight, 96) + 'px';
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className="p-2 rounded-md bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            <PaperAirplaneIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Simple Markdown Renderer ───────────────────────────────────

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: JSX.Element[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  const processInline = (text: string): JSX.Element[] => {
    const parts: JSX.Element[] = [];
    const regex = /(\*\*(.+?)\*\*)|(`(.+?)`)|(\*(.+?)\*)/g;
    let lastIndex = 0;
    let match;
    let idx = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`t${idx++}`}>{text.slice(lastIndex, match.index)}</span>,
        );
      }
      if (match[1]) {
        parts.push(<strong key={`b${idx++}`}>{match[2]}</strong>);
      } else if (match[3]) {
        parts.push(
          <code
            key={`c${idx++}`}
            className="bg-indigo-50 text-indigo-600 px-1 rounded text-[11px]"
          >
            {match[4]}
          </code>,
        );
      } else if (match[5]) {
        parts.push(<em key={`i${idx++}`}>{match[6]}</em>);
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push(<span key={`e${idx}`}>{text.slice(lastIndex)}</span>);
    }
    return parts.length > 0 ? parts : [<span key="plain">{text}</span>];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${i}`}
            className="bg-neutral-800 text-neutral-100 rounded-md p-2.5 text-[11px] overflow-x-auto my-1.5"
          >
            <code>{codeLines.join('\n')}</code>
          </pre>,
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={`br-${i}`} className="h-1" />);
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      elements.push(
        <h4
          key={`h3-${i}`}
          className="font-semibold text-neutral-800 text-xs mt-2 mb-0.5"
        >
          {processInline(line.slice(4))}
        </h4>,
      );
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h3
          key={`h2-${i}`}
          className="font-bold text-neutral-900 text-sm mt-2 mb-0.5"
        >
          {processInline(line.slice(3))}
        </h3>,
      );
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h2
          key={`h1-${i}`}
          className="font-bold text-neutral-900 text-base mt-2 mb-1"
        >
          {processInline(line.slice(2))}
        </h2>,
      );
      continue;
    }

    // Bullets
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const indent = line.match(/^\s*/)?.[0].length || 0;
      const text = line.trim().slice(2);
      elements.push(
        <div
          key={`li-${i}`}
          className="flex gap-1.5"
          style={{ paddingLeft: `${Math.min(indent, 8) * 4}px` }}
        >
          <span className="text-indigo-400 mt-0.5">&#8226;</span>
          <span>{processInline(text)}</span>
        </div>,
      );
      continue;
    }

    // Numbered lists
    const numMatch = line.trim().match(/^(\d+)\.\s(.+)/);
    if (numMatch) {
      elements.push(
        <div key={`ol-${i}`} className="flex gap-1.5">
          <span className="text-indigo-500 font-medium min-w-[16px]">
            {numMatch[1]}.
          </span>
          <span>{processInline(numMatch[2])}</span>
        </div>,
      );
      continue;
    }

    // Horizontal rule
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(
        <hr key={`hr-${i}`} className="border-neutral-200 my-2" />,
      );
      continue;
    }

    // Default paragraph
    elements.push(
      <p key={`p-${i}`} className="text-sm leading-relaxed">
        {processInline(line)}
      </p>,
    );
  }

  return <>{elements}</>;
}
