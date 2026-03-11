'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  SparklesIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  TrashIcon,
  ArrowPathIcon,
  CommandLineIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';
import {
  sendMessagingChatMessage,
  getMessagingChatHistory,
  clearMessagingChatHistory,
  MessagingChatMessage,
  MessagingChatResponse,
} from '@/lib/api';

interface MessagingChatbotProps {
  channelId: string;
}

const QUICK_ACTIONS = [
  { label: 'Summarize recent discussion', prompt: 'Summarize what has been discussed recently in this channel' },
  { label: 'What was discussed in calls?', prompt: 'What was discussed during the recent calls? Show me the call transcriptions' },
  { label: 'Key decisions made', prompt: 'What are the key decisions or conclusions from recent discussions?' },
  { label: 'Search for a topic', prompt: 'Search messages for important topics and give me a summary' },
  { label: 'Who is most active?', prompt: 'Who are the most active members in this channel and what do they discuss?' },
];

export default function MessagingChatbot({ channelId }: MessagingChatbotProps) {
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<MessagingChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevChannelIdRef = useRef<string | null>(null);

  // Reset when channel changes
  useEffect(() => {
    if (prevChannelIdRef.current && prevChannelIdRef.current !== channelId) {
      setMessages([]);
      setShowQuickActions(true);
      setError(null);
      setIsOpen(false);
    }
    prevChannelIdRef.current = channelId;
  }, [channelId]);

  // Load history when opened
  useEffect(() => {
    if (isOpen && channelId && messages.length === 0) {
      loadHistory();
    }
  }, [isOpen, channelId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const data = await getMessagingChatHistory(channelId);
      setMessages(data.messages || []);
      if (data.messages && data.messages.length > 0) {
        setShowQuickActions(false);
      }
    } catch {
      // Silent
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const sendMessage = useCallback(async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isLoading) return;

    setInput('');
    setError(null);
    setShowQuickActions(false);

    // Optimistic user message
    const userMsg: MessagingChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: msg,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response: MessagingChatResponse = await sendMessagingChatMessage(channelId, msg);

      const assistantMsg: MessagingChatMessage = {
        id: response.message_id,
        role: 'assistant',
        content: response.response,
        tool_calls: response.tool_calls,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 403) {
        setError('Access denied. You must be a member of this channel.');
      } else if (status === 401) {
        setError('Please log in to use the chatbot.');
      } else {
        setError('Failed to get a response. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, channelId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearMessagingChatHistory(channelId);
      setMessages([]);
      setShowQuickActions(true);
    } catch {
      // silent
    }
  };

  if (!isAuthenticated) return null;

  return (
    <>
      {/* Floating trigger / close button — always visible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200
                   flex items-center justify-center z-[60] group
                   ${isOpen
                     ? 'bg-neutral-800 hover:bg-red-600 text-white'
                     : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                   }`}
        title={isOpen ? 'Close chatbot' : 'Channel AI Assistant'}
      >
        {isOpen ? (
          <XMarkIcon className="w-6 h-6" />
        ) : (
          <>
            <ChatBubbleLeftRightIcon className="w-6 h-6 group-hover:animate-pulse" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
          </>
        )}
      </button>

      {/* Chat panel — positioned above the FAB */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 w-[min(420px,calc(100vw-2rem))] bg-white dark:bg-neutral-900 rounded-md shadow-lg
                        border border-neutral-200 dark:border-neutral-700 flex flex-col z-50 overflow-hidden
                        animate-in slide-in-from-bottom-4 duration-200"
             style={{ maxHeight: 'calc(100vh - 7rem)', height: '560px' }}>
          {/* Header */}
          <div className="bg-indigo-600 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <ChatBubbleLeftRightIcon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold text-sm">Channel Assistant</h3>
              <p className="text-white/70 text-[10px]">Ask about discussions, calls & transcriptions</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleClearHistory}
                className="p-1.5 rounded-md hover:bg-white/20 transition-colors"
                title="Clear chat history"
              >
                <TrashIcon className="w-4 h-4 text-white/70" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-md hover:bg-white/20 transition-colors"
                title="Close"
              >
                <XMarkIcon className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Messages area */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-10">
                <ArrowPathIcon className="w-5 h-5 text-neutral-400 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center mx-auto mb-3">
                  <SparklesIcon className="w-6 h-6 text-indigo-500" />
                </div>
                <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 mb-1">Channel Intelligence</h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 max-w-[280px] mx-auto">
                  Ask me about group discussions, call transcriptions, or search through channel messages.
                </p>
              </div>
            ) : null}

            {/* Quick actions */}
            {showQuickActions && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium">Quick actions</p>
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => sendMessage(action.prompt)}
                    className="w-full text-left px-3 py-2 rounded-md border border-neutral-200 dark:border-neutral-700
                               hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-neutral-800 transition-colors
                               text-xs text-neutral-700 dark:text-neutral-300"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}

            {/* Message list */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-md px-3.5 py-2.5 text-sm leading-relaxed
                    ${msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-sm shadow-sm'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-bl-sm'
                    }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none prose-p:my-1 prose-li:my-0.5
                                    prose-headings:my-1.5 prose-headings:text-neutral-900
                                    prose-strong:text-neutral-900 prose-code:text-indigo-600
                                    prose-code:bg-indigo-50 prose-code:px-1 prose-code:rounded
                                    prose-pre:bg-neutral-800 prose-pre:text-neutral-100
                                    prose-table:text-xs">
                      <MarkdownRenderer content={msg.content} />
                    </div>
                  ) : (
                    <span>{msg.content}</span>
                  )}

                  {/* Tool calls indicator */}
                  {msg.tool_calls && msg.tool_calls.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-neutral-200/50 dark:border-neutral-700">
                      <p className="text-[10px] text-neutral-400 mb-1">
                        Used {msg.tool_calls.length} tool{msg.tool_calls.length > 1 ? 's' : ''}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {msg.tool_calls.map((tc, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded
                                       bg-neutral-200/70 dark:bg-neutral-700 text-[10px] text-neutral-600 dark:text-neutral-400"
                          >
                            <CommandLineIcon className="w-2.5 h-2.5" />
                            {tc.name.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-neutral-100 dark:bg-neutral-800 rounded-md rounded-bl-sm px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-neutral-500">Analyzing channel...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-xs text-red-600">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-neutral-200 dark:border-neutral-700 px-3 py-2.5">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about discussions, calls, topics..."
                rows={1}
                className="flex-1 resize-none rounded-md border border-neutral-200 dark:border-neutral-700 px-3 py-2 text-sm
                           bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100
                           focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 dark:focus:ring-indigo-700 outline-none
                           placeholder:text-neutral-400 max-h-24 overflow-y-auto"
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
                className="p-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500
                           disabled:opacity-40 disabled:cursor-not-allowed transition-colors
                           flex-shrink-0"
              >
                <PaperAirplaneIcon className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[9px] text-neutral-400 mt-1 text-center">
              AI assistant for this channel · Searches messages & call transcriptions
            </p>
          </div>
        </div>
      )}
    </>
  );
}


// ── Simple Markdown Renderer ───────────────────────────────────

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: JSX.Element[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let isHeaderRow = true;

  const processInline = (text: string): JSX.Element[] => {
    const parts: JSX.Element[] = [];
    const regex = /(\*\*(.+?)\*\*)|(`(.+?)`)|(\*(.+?)\*)/g;
    let lastIndex = 0;
    let match;
    let idx = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={`t${idx++}`}>{text.slice(lastIndex, match.index)}</span>);
      }
      if (match[1]) {
        parts.push(<strong key={`b${idx++}`}>{match[2]}</strong>);
      } else if (match[3]) {
        parts.push(
          <code key={`c${idx++}`} className="bg-indigo-50 text-indigo-600 px-1 rounded text-[11px]">
            {match[4]}
          </code>
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

    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${i}`} className="bg-neutral-800 text-neutral-100 rounded-md p-2.5 text-[11px] overflow-x-auto my-1.5">
            <code>{codeLines.join('\n')}</code>
          </pre>
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

    if (line.trim().startsWith('|')) {
      const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
      if (cells.every(c => /^[-:]+$/.test(c))) {
        isHeaderRow = false;
        continue;
      }
      tableRows.push(cells);
      inTable = true;
      continue;
    } else if (inTable) {
      elements.push(
        <div key={`table-${i}`} className="overflow-x-auto my-1.5">
          <table className="w-full text-[11px] border-collapse">
            {tableRows.length > 0 && (
              <thead>
                <tr>
                  {tableRows[0].map((cell, ci) => (
                    <th key={ci} className="border-b border-neutral-300 dark:border-neutral-600 px-2 py-1 text-left font-semibold text-neutral-700 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-800">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {tableRows.slice(1).map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? '' : 'bg-neutral-50/50 dark:bg-neutral-800/50'}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border-b border-neutral-200 dark:border-neutral-700 px-2 py-1 text-neutral-600 dark:text-neutral-400">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
      isHeaderRow = true;
    }

    if (!line.trim()) {
      elements.push(<div key={`br-${i}`} className="h-1" />);
      continue;
    }

    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={`h3-${i}`} className="font-semibold text-neutral-800 dark:text-neutral-200 text-xs mt-2 mb-0.5">
          {processInline(line.slice(4))}
        </h4>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={`h2-${i}`} className="font-bold text-neutral-900 dark:text-neutral-100 text-sm mt-2 mb-0.5">
          {processInline(line.slice(3))}
        </h3>
      );
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h2 key={`h1-${i}`} className="font-bold text-neutral-900 dark:text-neutral-100 text-base mt-2 mb-1">
          {processInline(line.slice(2))}
        </h2>
      );
      continue;
    }

    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const indent = line.match(/^\s*/)?.[0].length || 0;
      const text = line.trim().slice(2);
      elements.push(
        <div key={`li-${i}`} className="flex gap-1.5" style={{ paddingLeft: `${Math.min(indent, 8) * 4}px` }}>
          <span className="text-indigo-400 mt-0.5">•</span>
          <span>{processInline(text)}</span>
        </div>
      );
      continue;
    }

    const numMatch = line.trim().match(/^(\d+)\.\s(.+)/);
    if (numMatch) {
      elements.push(
        <div key={`ol-${i}`} className="flex gap-1.5">
          <span className="text-indigo-500 font-medium min-w-[16px]">{numMatch[1]}.</span>
          <span>{processInline(numMatch[2])}</span>
        </div>
      );
      continue;
    }

    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(<hr key={`hr-${i}`} className="border-neutral-200 dark:border-neutral-700 my-2" />);
      continue;
    }

    elements.push(
      <p key={`p-${i}`} className="text-sm leading-relaxed">
        {processInline(line)}
      </p>
    );
  }

  if (inTable && tableRows.length > 0) {
    elements.push(
      <div key="table-end" className="overflow-x-auto my-1.5">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr>
              {tableRows[0].map((cell, ci) => (
                <th key={ci} className="border-b border-neutral-300 dark:border-neutral-600 px-2 py-1 text-left font-semibold text-neutral-700 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-800">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.slice(1).map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="border-b border-neutral-200 dark:border-neutral-700 px-2 py-1 text-neutral-600 dark:text-neutral-400">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return <>{elements}</>;
}
