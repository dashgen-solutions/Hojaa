'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  FaceSmileIcon,
  ChatBubbleLeftIcon,
  EllipsisHorizontalIcon,
  PencilIcon,
  TrashIcon,
  BookmarkIcon,
  MapPinIcon,
  PhoneIcon,
  PhoneXMarkIcon,
  VideoCameraIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import EmojiPicker from './EmojiPicker';
import {
  ChatMessageItem,
  addMessageReaction,
  removeMessageReaction,
  editChannelMessage,
  deleteChannelMessage,
  pinMessage,
  unpinMessage,
} from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface MessageThreadProps {
  messages: ChatMessageItem[];
  currentUserId: string;
  typingUsers: string[];
  onOpenThread: (message: ChatMessageItem) => void;
  onReply: (message: ChatMessageItem) => void;
  onMessageUpdate: (message: ChatMessageItem) => void;
  onMessageDelete: (messageId: string) => void;
}

function formatMessageContent(content: string): React.ReactNode {
  // Parse @mentions: @[username](userId)
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  const processText = (text: string): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    // Bold, italic, strikethrough, code, code block
    const formattedParts = text.split(/(`{3}[\s\S]*?`{3}|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~)/g);
    formattedParts.forEach((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3).replace(/^\n/, '');
        nodes.push(
          <pre key={i} className="bg-neutral-100 dark:bg-[#1a1d21] text-green-700 dark:text-green-400 px-3 py-2 rounded text-xs font-mono my-1 overflow-x-auto border border-neutral-200 dark:border-[#383a3f]">
            {code}
          </pre>
        );
      } else if (part.startsWith('`') && part.endsWith('`')) {
        nodes.push(
          <code key={i} className="bg-neutral-200 dark:bg-[#383a3f] text-orange-600 dark:text-orange-300 px-1 py-0.5 rounded text-xs font-mono">
            {part.slice(1, -1)}
          </code>
        );
      } else if (part.startsWith('**') && part.endsWith('**')) {
        nodes.push(<strong key={i} className="font-bold">{part.slice(2, -2)}</strong>);
      } else if (part.startsWith('*') && part.endsWith('*')) {
        nodes.push(<em key={i}>{part.slice(1, -1)}</em>);
      } else if (part.startsWith('~~') && part.endsWith('~~')) {
        nodes.push(<del key={i} className="line-through text-neutral-400 dark:text-gray-500">{part.slice(2, -2)}</del>);
      } else {
        // Handle line breaks and blockquotes
        const lines = part.split('\n');
        lines.forEach((line, li) => {
          if (line.startsWith('> ')) {
            nodes.push(
              <blockquote key={`${i}-${li}`} className="border-l-2 border-neutral-300 dark:border-[#565856] pl-2 text-neutral-500 dark:text-gray-400 italic my-0.5">
                {line.slice(2)}
              </blockquote>
            );
          } else if (line.startsWith('- ')) {
            nodes.push(
              <div key={`${i}-${li}`} className="flex items-start gap-1">
                <span className="text-neutral-400 dark:text-gray-500">•</span>
                <span>{line.slice(2)}</span>
              </div>
            );
          } else {
            if (li > 0) nodes.push(<br key={`br-${i}-${li}`} />);
            nodes.push(<span key={`${i}-${li}`}>{line}</span>);
          }
        });
      }
    });
    return nodes;
  };

  while ((match = mentionRegex.exec(content)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(...processText(content.slice(lastIndex, match.index)));
    }
    // Add the mention
    parts.push(
      <span
        key={`mention-${match.index}`}
        className="bg-blue-500/20 text-blue-300 px-1 rounded font-medium cursor-pointer hover:bg-blue-500/30"
      >
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

function MessageBubble({
  msg,
  currentUserId,
  isGrouped,
  onOpenThread,
  onReply,
  onMessageUpdate,
  onMessageDelete,
}: {
  msg: ChatMessageItem;
  currentUserId: string;
  isGrouped: boolean;
  onOpenThread: (msg: ChatMessageItem) => void;
  onReply: (msg: ChatMessageItem) => void;
  onMessageUpdate: (msg: ChatMessageItem) => void;
  onMessageDelete: (messageId: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(msg.content);
  const menuRef = useRef<HTMLDivElement>(null);
  const isOwn = msg.sender_id === currentUserId;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleReaction = async (emoji: string) => {
    try {
      // Check if user already reacted with this emoji
      const existingReaction = msg.reactions?.find(
        (r) => r.emoji === emoji && r.users.some((u) => u.user_id === currentUserId)
      );
      if (existingReaction) {
        // Optimistic: remove locally
        const updated = {
          ...msg,
          reactions: (msg.reactions || [])
            .map((r) => {
              if (r.emoji !== emoji) return r;
              const users = r.users.filter((u) => u.user_id !== currentUserId);
              return users.length > 0 ? { ...r, count: users.length, users } : null;
            })
            .filter(Boolean) as typeof msg.reactions,
        };
        onMessageUpdate(updated);
        await removeMessageReaction(msg.id, emoji);
      } else {
        // Optimistic: add locally
        const reactions = [...(msg.reactions || [])];
        const group = reactions.find((r) => r.emoji === emoji);
        if (group) {
          group.count += 1;
          group.users = [...group.users, { user_id: currentUserId, username: 'You' }];
        } else {
          reactions.push({ emoji, count: 1, users: [{ user_id: currentUserId, username: 'You' }] });
        }
        onMessageUpdate({ ...msg, reactions });
        await addMessageReaction(msg.id, emoji);
      }
    } catch {
      // Ignore — will be synced via WebSocket
    }
    setShowEmojiPicker(false);
  };

  const handleEdit = async () => {
    if (!editContent.trim()) return;
    try {
      const updated = await editChannelMessage(msg.id, editContent.trim());
      onMessageUpdate(updated);
      setIsEditing(false);
    } catch {
      // ignore
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this message?')) return;
    try {
      await deleteChannelMessage(msg.id);
      onMessageDelete(msg.id);
    } catch {
      // ignore
    }
  };

  const handlePin = async () => {
    try {
      if (msg.is_pinned) {
        await unpinMessage(msg.id);
      } else {
        await pinMessage(msg.id);
      }
    } catch {
      // ignore
    }
    setShowMenu(false);
  };

  const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Avatar: use uploaded photo, fall back to neutral SVG placeholder
  const [avatarError, setAvatarError] = React.useState(false);
  const avatarSrc =
    !avatarError &&
    msg.sender_avatar_url &&
    (msg.sender_avatar_url.startsWith('http')
      ? msg.sender_avatar_url
      : `${API_URL}${msg.sender_avatar_url}`);

  return (
    <div
      className={`group relative flex gap-2.5 px-5 py-0.5 hover:bg-neutral-50 dark:hover:bg-[#222529]/50 transition-colors ${
        isGrouped ? '' : 'mt-3'
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        if (!showEmojiPicker && !showMenu) {
          setShowEmojiPicker(false);
          setShowMenu(false);
        }
      }}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 w-9">
        {!isGrouped && (
          avatarSrc ? (
            <img
              src={avatarSrc}
              alt={msg.sender_name}
              className="w-9 h-9 rounded-lg object-cover border border-neutral-200 dark:border-[#383a3f]"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center">
              <UserCircleIcon className="w-6 h-6 text-neutral-400 dark:text-neutral-500" />
            </div>
          )
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {!isGrouped && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-sm font-bold text-neutral-800 dark:text-gray-200 hover:underline cursor-pointer">
              {msg.sender_name}
            </span>
            <span className="text-[10px] text-neutral-400 dark:text-gray-500">{time}</span>
            {msg.is_edited && (
              <span className="text-[10px] text-neutral-400 dark:text-gray-600 italic">(edited)</span>
            )}
            {msg.is_pinned && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-yellow-600 dark:text-yellow-400 font-medium"><MapPinIcon className="w-3 h-3" />Pinned</span>
            )}
          </div>
        )}

        {/* Message content */}
        {isEditing ? (
          <div className="mt-1">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-neutral-50 dark:bg-[#222529] border border-blue-500 rounded-lg px-3 py-2 text-sm text-neutral-800 dark:text-gray-200 focus:outline-none resize-none"
              rows={2}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEdit(); }
                if (e.key === 'Escape') setIsEditing(false);
              }}
            />
            <div className="flex gap-2 mt-1">
              <button onClick={handleEdit} className="text-xs text-blue-400 hover:text-blue-300">Save</button>
              <button onClick={() => setIsEditing(false)} className="text-xs text-gray-500 hover:text-gray-400">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="text-[13px] text-neutral-700 dark:text-gray-300 leading-relaxed break-words">
            {formatMessageContent(msg.content)}
          </div>
        )}

        {/* Attachments */}
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1.5">
            {msg.attachments.map((att) => (
              <a
                key={att.id}
                href={att.file_url}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-100 dark:bg-[#222529] border border-neutral-200 dark:border-[#383a3f] rounded-lg text-xs text-neutral-600 dark:text-gray-300 hover:border-blue-500 transition-colors"
              >
                <span>📎</span>
                <span className="truncate max-w-[150px]">{att.file_name}</span>
                {att.file_size && (
                  <span className="text-gray-500">
                    {att.file_size > 1024 * 1024
                      ? `${(att.file_size / 1024 / 1024).toFixed(1)}MB`
                      : `${Math.round(att.file_size / 1024)}KB`}
                  </span>
                )}
              </a>
            ))}
          </div>
        )}

        {/* Reactions */}
        {msg.reactions && msg.reactions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-1.5">
            {msg.reactions.map((r) => {
              const iReacted = r.users.some((u) => u.user_id === currentUserId);
              const names = r.users.map((u) => u.user_id === currentUserId ? 'You' : u.username).join(', ');
              return (
                <button
                  key={r.emoji}
                  onClick={() => handleReaction(r.emoji)}
                  className={`group/reaction relative flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                    iReacted
                      ? 'bg-blue-600/20 border-blue-500/40 text-blue-400 dark:text-blue-300 hover:bg-blue-600/30'
                      : 'bg-neutral-100 dark:bg-[#222529] border-neutral-200 dark:border-[#383a3f] text-neutral-600 dark:text-gray-400 hover:border-neutral-400 dark:hover:border-gray-500 hover:bg-neutral-200 dark:hover:bg-[#2a2d32]'
                  }`}
                >
                  <span className="text-sm">{r.emoji}</span>
                  <span className="font-medium">{r.count}</span>
                  {/* Tooltip */}
                  <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 dark:bg-gray-700 px-2 py-1 text-[10px] text-white opacity-0 group-hover/reaction:opacity-100 transition-opacity shadow-lg z-20">
                    {names}
                  </span>
                </button>
              );
            })}
            <button
              onClick={() => setShowEmojiPicker(true)}
              className="flex items-center px-1.5 py-0.5 rounded-full text-xs border border-dashed border-neutral-300 dark:border-[#383a3f] text-neutral-400 dark:text-gray-500 hover:border-neutral-400 dark:hover:border-gray-400 hover:text-neutral-500 dark:hover:text-gray-400 transition-colors"
              title="Add reaction"
            >
              <FaceSmileIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Thread reply count */}
        {msg.thread_reply_count > 0 && (
          <button
            onClick={() => onOpenThread(msg)}
            className="flex items-center gap-1.5 mt-1.5 text-xs text-blue-400 hover:text-blue-300 hover:underline"
          >
            <ChatBubbleLeftIcon className="w-3.5 h-3.5" />
            <span>{msg.thread_reply_count} {msg.thread_reply_count === 1 ? 'reply' : 'replies'}</span>
          </button>
        )}
      </div>

      {/* Hover action toolbar (Slack-style) */}
      {showActions && !isEditing && (
        <div className="absolute right-4 -top-3 flex items-center bg-white dark:bg-[#1a1d21] border border-neutral-200 dark:border-[#383a3f] rounded-lg shadow-lg z-10">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-1.5 text-neutral-400 dark:text-gray-400 hover:text-yellow-400 hover:bg-neutral-100 dark:hover:bg-[#383a3f] rounded-l-lg transition-colors"
            title="Add reaction"
          >
            <FaceSmileIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onReply(msg)}
            className="p-1.5 text-neutral-400 dark:text-gray-400 hover:text-blue-400 hover:bg-neutral-100 dark:hover:bg-[#383a3f] transition-colors"
            title="Reply in thread"
          >
            <ChatBubbleLeftIcon className="w-4 h-4" />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 text-neutral-400 dark:text-gray-400 hover:text-neutral-600 dark:hover:text-gray-200 hover:bg-neutral-100 dark:hover:bg-[#383a3f] rounded-r-lg transition-colors"
              title="More actions"
            >
              <EllipsisHorizontalIcon className="w-4 h-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-[#1a1d21] border border-neutral-200 dark:border-[#383a3f] rounded-lg shadow-2xl z-20 py-1">
                <button
                  onClick={() => { onOpenThread(msg); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-700 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-[#383a3f] transition-colors"
                >
                  <ChatBubbleLeftIcon className="w-4 h-4" />
                  Open thread
                </button>
                <button
                  onClick={() => { handlePin(); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-700 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-[#383a3f] transition-colors"
                >
                  <MapPinIcon className="w-4 h-4" />
                  {msg.is_pinned ? 'Unpin message' : 'Pin message'}
                </button>
                {isOwn && (
                  <>
                    <button
                      onClick={() => { setIsEditing(true); setEditContent(msg.content); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-700 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-[#383a3f] transition-colors"
                    >
                      <PencilIcon className="w-4 h-4" />
                      Edit message
                    </button>
                    <div className="border-t border-neutral-200 dark:border-[#383a3f] my-1" />
                    <button
                      onClick={handleDelete}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                      Delete message
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Emoji picker from hover toolbar */}
      {showEmojiPicker && (
        <EmojiPicker
          onSelect={handleReaction}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}
    </div>
  );
}

/** Strip leading 📞 / 📵 from backend call messages (UTF-16 pairs; avoids \\p{Emoji} for older TS targets). */
function stripCallEventEmojiPrefix(content: string): string {
  let s = content.trimStart();
  // 📞 U+1F4DE, 📵 U+1F4F5 (surrogate pairs)
  const phone = '\uD83D\uDCDE';
  const noSignal = '\uD83D\uDCF5';
  if (s.startsWith(phone)) s = s.slice(phone.length);
  else if (s.startsWith(noSignal)) s = s.slice(noSignal.length);
  if (s.startsWith('\uFE0F')) s = s.slice(1); // optional variation selector
  return s.trimStart();
}

/** Renders a call event system message (call started, ended, missed). */
function CallEventMessage({ msg }: { msg: ChatMessageItem }) {
  const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isMissed = msg.message_type === 'call_missed';
  const isEnded = msg.message_type === 'call_ended';

  const displayText = stripCallEventEmojiPrefix(msg.content);

  return (
    <div className="flex items-center justify-center py-2 px-5 my-1">
      <div
        className={`flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-medium border ${
          isMissed
            ? 'bg-red-500/10 text-red-400 border-red-500/20'
            : isEnded
            ? 'bg-neutral-100 dark:bg-[#222529] text-neutral-500 dark:text-gray-400 border-neutral-200 dark:border-[#383a3f]'
            : 'bg-green-500/10 text-green-400 border-green-500/20'
        }`}
      >
        {isMissed ? (
          <PhoneXMarkIcon className="w-4 h-4" />
        ) : (
          <PhoneIcon className="w-4 h-4" />
        )}
        <span>{displayText}</span>
        <span className="text-[10px] opacity-60">{time}</span>
      </div>
    </div>
  );
}

export default function MessageThreadEnhanced({
  messages,
  currentUserId,
  typingUsers,
  onOpenThread,
  onReply,
  onMessageUpdate,
  onMessageDelete,
}: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 100);
  };

  // Group messages by date
  const groupedByDate: { date: string; messages: ChatMessageItem[] }[] = [];
  let currentDate = '';
  messages.forEach((msg) => {
    const msgDate = new Date(msg.created_at).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groupedByDate.push({ date: msgDate, messages: [msg] });
    } else {
      groupedByDate[groupedByDate.length - 1].messages.push(msg);
    }
  });

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto overflow-x-hidden py-2"
    >
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-neutral-400 dark:text-gray-500">
          <ChatBubbleLeftIcon className="w-12 h-12 mb-3 text-neutral-300 dark:text-gray-600" />
          <p className="text-base font-medium">No messages yet</p>
          <p className="text-sm mt-1">Start the conversation!</p>
        </div>
      )}

      {groupedByDate.map((group) => (
        <div key={group.date}>
          {/* Date separator */}
          <div className="flex items-center gap-3 px-5 my-4">
            <div className="flex-1 h-px bg-neutral-200 dark:bg-[#383a3f]" />
            <span className="text-[11px] text-neutral-500 dark:text-gray-500 font-medium bg-white dark:bg-[#1e2024] px-3 py-1 rounded-full border border-neutral-200 dark:border-[#383a3f]">
              {group.date}
            </span>
            <div className="flex-1 h-px bg-neutral-200 dark:bg-[#383a3f]" />
          </div>

          {/* Messages */}
          {group.messages.map((msg, idx) => {
            // Render call event messages with special UI
            if (msg.message_type && ['call_started', 'call_ended', 'call_missed'].includes(msg.message_type)) {
              return <CallEventMessage key={msg.id} msg={msg} />;
            }

            const prev = idx > 0 ? group.messages[idx - 1] : null;
            const isGrouped =
              prev !== null &&
              !prev.message_type &&
              prev.sender_id === msg.sender_id &&
              new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000;

            return (
              <MessageBubble
                key={msg.id}
                msg={msg}
                currentUserId={currentUserId}
                isGrouped={isGrouped}
                onOpenThread={onOpenThread}
                onReply={onReply}
                onMessageUpdate={onMessageUpdate}
                onMessageDelete={onMessageDelete}
              />
            );
          })}
        </div>
      ))}

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-5 py-2 flex items-center gap-2 text-[12px] text-gray-500">
          <div className="flex gap-0.5">
            <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span>
            {typingUsers.length === 1
              ? `${typingUsers[0]} is typing...`
              : `${typingUsers.join(', ')} are typing...`}
          </span>
        </div>
      )}
    </div>
  );
}
