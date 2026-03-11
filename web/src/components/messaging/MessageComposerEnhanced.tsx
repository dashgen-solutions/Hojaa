'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  PaperAirplaneIcon,
  FaceSmileIcon,
  AtSymbolIcon,
  CodeBracketIcon,
} from '@heroicons/react/24/outline';
import EmojiPicker from './EmojiPicker';
import { getMentionableUsers, MentionableUser } from '@/lib/api';

interface MessageComposerProps {
  channelId: string;
  onSend: (content: string, options?: {
    reference?: { type: string; id: string; name: string };
    parent_message_id?: string;
    mentions?: string[];
  }) => void;
  onTyping: () => void;
  disabled?: boolean;
  replyTo?: { id: string; sender_name: string; content: string } | null;
  onCancelReply?: () => void;
  placeholder?: string;
}

export default function MessageComposer({
  channelId,
  onSend,
  onTyping,
  disabled = false,
  replyTo,
  onCancelReply,
  placeholder = 'Type a message...',
}: MessageComposerProps) {
  const [content, setContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionUsers, setMentionUsers] = useState<MentionableUser[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [collectedMentions, setCollectedMentions] = useState<string[]>([]);
  const [mentionMap, setMentionMap] = useState<Map<string, string>>(new Map()); // username -> userId
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mentionRef = useRef<HTMLDivElement>(null);

  // Fetch mentionable users when @ is typed
  useEffect(() => {
    if (!showMentions || !channelId) return;
    const fetchUsers = async () => {
      try {
        const users = await getMentionableUsers(channelId, mentionQuery);
        setMentionUsers(users);
        setMentionIndex(0);
      } catch {
        setMentionUsers([]);
      }
    };
    const timer = setTimeout(fetchUsers, 150);
    return () => clearTimeout(timer);
  }, [showMentions, mentionQuery, channelId]);

  const insertMention = useCallback((user: MentionableUser) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBefore = content.substring(0, cursorPos);
    const textAfter = content.substring(cursorPos);

    // Find the @ that triggered the mention
    const atIndex = textBefore.lastIndexOf('@');
    if (atIndex === -1) return;

    // Show only @username in the textarea (human-readable)
    const newText = textBefore.substring(0, atIndex) + `@${user.username} ` + textAfter;
    setContent(newText);
    setCollectedMentions((prev) => [...prev, user.id]);
    setMentionMap((prev) => new Map(prev).set(user.username, user.id));
    setShowMentions(false);
    setMentionQuery('');
    textarea.focus();
  }, [content]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle mention navigation
    if (showMentions && mentionUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % mentionUsers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + mentionUsers.length) % mentionUsers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(mentionUsers[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowMentions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed || disabled) return;

    // Reconstruct @[username](userId) syntax for the server
    let messageToSend = trimmed;
    mentionMap.forEach((userId, username) => {
      // Replace all occurrences of @username with @[username](userId)
      const pattern = new RegExp(`@${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\w)`, 'g');
      messageToSend = messageToSend.replace(pattern, `@[${username}](${userId})`);
    });

    onSend(messageToSend, {
      parent_message_id: replyTo?.id,
      mentions: collectedMentions.length > 0 ? collectedMentions : undefined,
    });
    setContent('');
    setCollectedMentions([]);
    setMentionMap(new Map());
    if (onCancelReply) onCancelReply();

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);

    // Auto-resize
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';

    // Detect @ mentions
    const cursorPos = ta.selectionStart;
    const textBefore = value.substring(0, cursorPos);
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      setShowMentions(true);
      setMentionQuery(atMatch[1] || '');
    } else {
      setShowMentions(false);
    }

    // Typing indicator (debounced)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {}, 2000);
    onTyping();
  };

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => prev + emoji);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = content.substring(0, start) + emoji + content.substring(end);
    setContent(newText);
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
      textarea.focus();
    }, 0);
  };

  const insertFormatting = (prefix: string, suffix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const newText = content.substring(0, start) + prefix + (selected || 'text') + suffix + content.substring(end);
    setContent(newText);
    setTimeout(() => {
      if (selected) {
        textarea.selectionStart = start + prefix.length;
        textarea.selectionEnd = start + prefix.length + selected.length;
      } else {
        textarea.selectionStart = start + prefix.length;
        textarea.selectionEnd = start + prefix.length + 4;
      }
      textarea.focus();
    }, 0);
  };

  return (
    <div className="border-t border-neutral-200 dark:border-[#383a3f] px-4 py-3 flex-shrink-0 bg-white dark:bg-[#1a1d21]">
      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-neutral-50 dark:bg-[#222529] rounded-lg border-l-2 border-blue-500">
          <div className="flex-1 min-w-0">
            <span className="text-xs text-blue-400 font-medium">Replying to {replyTo.sender_name}</span>
            <p className="text-xs text-neutral-500 dark:text-gray-400 truncate">{replyTo.content}</p>
          </div>
          <button
            onClick={onCancelReply}
            className="text-neutral-400 dark:text-gray-500 hover:text-neutral-600 dark:hover:text-gray-300 text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Formatting toolbar */}
      <div className="flex items-center gap-1 mb-1.5 px-1">
        <button
          onClick={() => insertFormatting('**', '**')}
          className="p-1 rounded text-neutral-400 dark:text-gray-500 hover:text-neutral-600 dark:hover:text-gray-300 hover:bg-neutral-100 dark:hover:bg-[#383a3f] transition-colors"
          title="Bold (Ctrl+B)"
        >
          <span className="text-xs font-bold">B</span>
        </button>
        <button
          onClick={() => insertFormatting('*', '*')}
          className="p-1 rounded text-neutral-400 dark:text-gray-500 hover:text-neutral-600 dark:hover:text-gray-300 hover:bg-neutral-100 dark:hover:bg-[#383a3f] transition-colors"
          title="Italic (Ctrl+I)"
        >
          <span className="text-xs italic">I</span>
        </button>
        <button
          onClick={() => insertFormatting('~~', '~~')}
          className="p-1 rounded text-neutral-400 dark:text-gray-500 hover:text-neutral-600 dark:hover:text-gray-300 hover:bg-neutral-100 dark:hover:bg-[#383a3f] transition-colors"
          title="Strikethrough"
        >
          <span className="text-xs line-through">S</span>
        </button>
        <button
          onClick={() => insertFormatting('`', '`')}
          className="p-1 rounded text-neutral-400 dark:text-gray-500 hover:text-neutral-600 dark:hover:text-gray-300 hover:bg-neutral-100 dark:hover:bg-[#383a3f] transition-colors"
          title="Inline code"
        >
          <CodeBracketIcon className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => insertFormatting('\n```\n', '\n```\n')}
          className="p-1 rounded text-neutral-400 dark:text-gray-500 hover:text-neutral-600 dark:hover:text-gray-300 hover:bg-neutral-100 dark:hover:bg-[#383a3f] transition-colors"
          title="Code block"
        >
          <span className="text-[10px] font-mono">{'{}'}</span>
        </button>
        <div className="w-px h-4 bg-neutral-200 dark:bg-[#383a3f] mx-1" />
        <button
          onClick={() => insertFormatting('> ', '')}
          className="p-1 rounded text-neutral-400 dark:text-gray-500 hover:text-neutral-600 dark:hover:text-gray-300 hover:bg-neutral-100 dark:hover:bg-[#383a3f] transition-colors"
          title="Quote"
        >
          <span className="text-xs">"</span>
        </button>
        <button
          onClick={() => insertFormatting('- ', '')}
          className="p-1 rounded text-neutral-400 dark:text-gray-500 hover:text-neutral-600 dark:hover:text-gray-300 hover:bg-neutral-100 dark:hover:bg-[#383a3f] transition-colors"
          title="Bullet list"
        >
          <span className="text-xs">• List</span>
        </button>
      </div>

      <div className="relative">
        {/* @Mention autocomplete popup */}
        {showMentions && mentionUsers.length > 0 && (
          <div
            ref={mentionRef}
            className="absolute bottom-full left-0 mb-1 w-64 bg-white dark:bg-[#1a1d21] border border-neutral-200 dark:border-[#383a3f] rounded-lg shadow-2xl z-50 max-h-48 overflow-y-auto"
          >
            {mentionUsers.map((user, idx) => (
              <button
                key={user.id}
                onClick={() => insertMention(user)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                  idx === mentionIndex ? 'bg-blue-600/20 text-blue-300' : 'text-neutral-700 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-[#383a3f]'
                }`}
              >
                <div className="relative">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-[10px] text-white font-bold">
                    {user.username[0]?.toUpperCase()}
                  </div>
                  {user.is_online && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white dark:border-[#1a1d21]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{user.username}</div>
                  <div className="text-[10px] text-neutral-400 dark:text-gray-500 truncate">{user.email}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <EmojiPicker
            onSelect={insertEmoji}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className="w-full resize-none text-[13px] text-neutral-800 dark:text-gray-200 bg-neutral-50 dark:bg-[#222529] border border-neutral-200 dark:border-[#383a3f] rounded-lg px-3 py-2.5 pr-24 focus:outline-none focus:border-neutral-400 dark:focus:border-[#565856] placeholder-neutral-400 dark:placeholder-gray-500 disabled:opacity-50"
              style={{ maxHeight: '160px' }}
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-0.5">
              <button
                onClick={() => {
                  const textarea = textareaRef.current;
                  if (textarea) {
                    const pos = textarea.selectionStart;
                    const newText = content.substring(0, pos) + '@' + content.substring(pos);
                    setContent(newText);
                    setShowMentions(true);
                    setMentionQuery('');
                    setTimeout(() => {
                      textarea.selectionStart = textarea.selectionEnd = pos + 1;
                      textarea.focus();
                    }, 0);
                  }
                }}
                className="p-1 rounded text-neutral-400 dark:text-gray-500 hover:text-blue-400 hover:bg-neutral-100 dark:hover:bg-[#383a3f] transition-colors"
                title="Mention someone (@)"
              >
                <AtSymbolIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-1 rounded text-neutral-400 dark:text-gray-500 hover:text-yellow-400 hover:bg-neutral-100 dark:hover:bg-[#383a3f] transition-colors"
                title="Emoji"
              >
                <FaceSmileIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
          <button
            onClick={handleSend}
            disabled={!content.trim() || disabled}
            className="p-2.5 rounded-lg bg-green-600 text-white hover:bg-green-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            title="Send message (Enter)"
          >
            <PaperAirplaneIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
      <p className="text-[10px] text-neutral-400 dark:text-gray-600 mt-1 px-1">
        <span className="text-neutral-500 dark:text-gray-500">Enter</span> to send · <span className="text-neutral-500 dark:text-gray-500">Shift+Enter</span> for new line · <span className="text-neutral-500 dark:text-gray-500">@</span> to mention · <span className="text-neutral-500 dark:text-gray-500">**bold**</span> · <span className="text-neutral-500 dark:text-gray-500">*italic*</span>
      </p>
    </div>
  );
}
