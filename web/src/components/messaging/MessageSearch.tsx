'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { searchMessages, ChatMessageItem } from '@/lib/api';

interface MessageSearchProps {
  channelId?: string;
  onSelectMessage?: (msg: ChatMessageItem & { channel_name: string | null }) => void;
  onClose: () => void;
}

export default function MessageSearch({ channelId, onSelectMessage, onClose }: MessageSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<(ChatMessageItem & { channel_name: string | null; is_direct: boolean })[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const performSearch = useCallback(
    async (q: string) => {
      if (q.length < 1) {
        setResults([]);
        setTotal(0);
        return;
      }
      try {
        setLoading(true);
        const data = await searchMessages(q, channelId);
        setResults(data.results);
        setTotal(data.total);
      } catch {
        setResults([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [channelId]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(val), 300);
  };

  const highlightMatch = (text: string, q: string) => {
    if (!q) return text;
    const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark key={i} className="bg-yellow-500/30 text-yellow-200 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="w-[400px] border-l border-neutral-200 dark:border-[#383a3f] bg-white dark:bg-[#1e2024] flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-200 dark:border-[#383a3f]">
        <MagnifyingGlassIcon className="w-5 h-5 text-neutral-400 dark:text-gray-400 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Search messages..."
          className="flex-1 bg-transparent text-sm text-neutral-800 dark:text-gray-200 placeholder-neutral-400 dark:placeholder-gray-500 focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
          }}
        />
        <button
          onClick={onClose}
          className="p-1 rounded text-neutral-400 dark:text-gray-400 hover:text-neutral-600 dark:hover:text-gray-200 hover:bg-neutral-100 dark:hover:bg-[#383a3f] transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && query && results.length === 0 && (
          <div className="text-center text-neutral-400 dark:text-gray-500 text-sm py-8">
            No messages found for &quot;{query}&quot;
          </div>
        )}

        {!loading && results.length > 0 && (
          <>
            <div className="px-4 py-2 text-xs text-neutral-500 dark:text-gray-500 border-b border-neutral-100 dark:border-[#383a3f]/50">
              {total} result{total !== 1 ? 's' : ''}
            </div>
            {results.map((msg) => (
              <button
                key={msg.id}
                onClick={() => onSelectMessage?.(msg)}
                className="w-full text-left px-4 py-3 border-b border-neutral-100 dark:border-[#383a3f]/30 hover:bg-neutral-50 dark:hover:bg-[#222529] transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-neutral-700 dark:text-gray-300">{msg.sender_name}</span>
                  <span className="text-[10px] text-neutral-400 dark:text-gray-500">
                    in {msg.channel_name || (msg.is_direct ? 'DM' : 'channel')}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-gray-600 ml-auto">
                    {new Date(msg.created_at).toLocaleDateString()} {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="text-[13px] text-neutral-600 dark:text-gray-400 line-clamp-2">
                  {highlightMatch(msg.content.substring(0, 200), query)}
                </div>
              </button>
            ))}
          </>
        )}

        {!query && !loading && (
          <div className="flex flex-col items-center justify-center h-64 text-neutral-400 dark:text-gray-500">
            <MagnifyingGlassIcon className="w-10 h-10 mb-3 text-neutral-300 dark:text-gray-600" />
            <p className="text-sm">Search across all your conversations</p>
          </div>
        )}
      </div>
    </div>
  );
}
