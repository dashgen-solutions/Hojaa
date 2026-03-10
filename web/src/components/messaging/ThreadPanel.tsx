'use client';

import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';
import MessageComposerEnhanced from './MessageComposerEnhanced';
import {
  ChatMessageItem,
  getMessageThread,
  sendChannelMessage,
  addMessageReaction,
  removeMessageReaction,
} from '@/lib/api';
import EmojiPicker from './EmojiPicker';
import { FaceSmileIcon } from '@heroicons/react/24/outline';

interface ThreadPanelProps {
  parentMessage: ChatMessageItem;
  channelId: string;
  currentUserId: string;
  onClose: () => void;
  onNewReply?: (reply: ChatMessageItem) => void;
}

function formatMessageContent(content: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  const processText = (text: string): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    const formattedParts = text.split(/(`{3}[\s\S]*?`{3}|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~)/g);
    formattedParts.forEach((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3).replace(/^\n/, '');
        nodes.push(
          <pre key={i} className="bg-[#1a1d21] text-green-400 px-3 py-2 rounded text-xs font-mono my-1 overflow-x-auto border border-[#383a3f]">
            {code}
          </pre>
        );
      } else if (part.startsWith('`') && part.endsWith('`')) {
        nodes.push(
          <code key={i} className="bg-[#383a3f] text-orange-300 px-1 py-0.5 rounded text-xs font-mono">
            {part.slice(1, -1)}
          </code>
        );
      } else if (part.startsWith('**') && part.endsWith('**')) {
        nodes.push(<strong key={i} className="font-bold">{part.slice(2, -2)}</strong>);
      } else if (part.startsWith('*') && part.endsWith('*')) {
        nodes.push(<em key={i}>{part.slice(1, -1)}</em>);
      } else if (part.startsWith('~~') && part.endsWith('~~')) {
        nodes.push(<del key={i} className="line-through text-gray-500">{part.slice(2, -2)}</del>);
      } else {
        nodes.push(<span key={i}>{part}</span>);
      }
    });
    return nodes;
  };

  while ((match = mentionRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...processText(content.slice(lastIndex, match.index)));
    }
    parts.push(
      <span key={`mention-${match.index}`} className="bg-blue-500/20 text-blue-300 px-1 rounded font-medium">
        @{match[1]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push(...processText(content.slice(lastIndex)));
  }
  return <>{parts}</>;
}

export default function ThreadPanel({
  parentMessage,
  channelId,
  currentUserId,
  onClose,
  onNewReply,
}: ThreadPanelProps) {
  const [replies, setReplies] = useState<ChatMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadThread();
  }, [parentMessage.id]);

  const loadThread = async () => {
    try {
      setLoading(true);
      const data = await getMessageThread(parentMessage.id);
      setReplies(data.replies);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    }
  };

  const handleSend = async (content: string, options?: { mentions?: string[] }) => {
    try {
      const reply = await sendChannelMessage(channelId, {
        content,
        parent_message_id: parentMessage.id,
        mentions: options?.mentions,
      });
      setReplies((prev) => [...prev, reply]);
      onNewReply?.(reply);
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    } catch {
      // ignore
    }
  };

  const avatarColors = [
    'from-blue-500 to-purple-500',
    'from-green-500 to-teal-500',
    'from-orange-500 to-red-500',
    'from-pink-500 to-rose-500',
    'from-indigo-500 to-blue-500',
    'from-yellow-500 to-orange-500',
  ];

  const getAvatarColor = (name: string) => {
    const idx = (name || '').charCodeAt(0) % avatarColors.length;
    return avatarColors[idx];
  };

  return (
    <div className="w-[400px] border-l border-[#383a3f] bg-[#1e2024] flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#383a3f]">
        <div className="flex items-center gap-2">
          <ChatBubbleLeftIcon className="w-5 h-5 text-gray-400" />
          <h3 className="text-sm font-bold text-gray-200">Thread</h3>
          <span className="text-xs text-gray-500">
            {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-[#383a3f] transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Thread content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {/* Parent message */}
        <div className="px-4 py-3 border-b border-[#383a3f]/50">
          <div className="flex items-start gap-2.5">
            <div
              className={`w-9 h-9 rounded-lg bg-gradient-to-br ${getAvatarColor(parentMessage.sender_name)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}
            >
              {parentMessage.sender_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-gray-200">{parentMessage.sender_name}</span>
                <span className="text-[10px] text-gray-500">
                  {new Date(parentMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="text-[13px] text-gray-300 mt-0.5 break-words">
                {formatMessageContent(parentMessage.content)}
              </div>
              {/* Parent reactions */}
              {parentMessage.reactions && parentMessage.reactions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {parentMessage.reactions.map((r) => {
                    const iReacted = r.users.some((u) => u.user_id === currentUserId);
                    return (
                      <button
                        key={r.emoji}
                        onClick={async () => {
                          try {
                            if (iReacted) await removeMessageReaction(parentMessage.id, r.emoji);
                            else await addMessageReaction(parentMessage.id, r.emoji);
                          } catch {}
                        }}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                          iReacted
                            ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                            : 'bg-[#222529] border-[#383a3f] text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        <span>{r.emoji}</span>
                        <span className="font-medium">{r.count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
            <div className="h-px flex-1 bg-[#383a3f]" />
            <span>{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</span>
            <div className="h-px flex-1 bg-[#383a3f]" />
          </div>
        </div>

        {/* Replies */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="py-2">
            {replies.map((reply, idx) => {
              const prev = idx > 0 ? replies[idx - 1] : null;
              const isGrouped =
                prev !== null &&
                prev.sender_id === reply.sender_id &&
                new Date(reply.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000;

              return (
                <div key={reply.id} className={`flex gap-2.5 px-4 py-0.5 hover:bg-[#222529]/50 ${isGrouped ? '' : 'mt-2.5'}`}>
                  <div className="flex-shrink-0 w-8">
                    {!isGrouped && (
                      <div
                        className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getAvatarColor(reply.sender_name)} flex items-center justify-center text-white text-xs font-bold`}
                      >
                        {reply.sender_name?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {!isGrouped && (
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-sm font-bold text-gray-200">{reply.sender_name}</span>
                        <span className="text-[10px] text-gray-500">
                          {new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                    <div className="text-[13px] text-gray-300 break-words">
                      {formatMessageContent(reply.content)}
                    </div>
                    {reply.reactions && reply.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {reply.reactions.map((r) => (
                          <span key={r.emoji} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs bg-[#222529] border border-[#383a3f] text-gray-400">
                            {r.emoji} {r.count}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Composer */}
      <MessageComposerEnhanced
        channelId={channelId}
        onSend={handleSend}
        onTyping={() => {}}
        placeholder="Reply..."
      />
    </div>
  );
}
