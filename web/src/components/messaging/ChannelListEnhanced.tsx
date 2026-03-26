'use client';

import React, { useState, useMemo } from 'react';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  HashtagIcon,
  UserCircleIcon,
  ChatBubbleLeftRightIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline';
import { ChatChannel } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** Avatar for a DM channel — shows photo, falls back to SVG placeholder */
function DmAvatar({ avatarUrl, username }: { avatarUrl?: string | null; username: string }) {
  const [error, setError] = useState(false);
  const src =
    !error &&
    avatarUrl &&
    (avatarUrl.startsWith('http') ? avatarUrl : `${API_URL}${avatarUrl}`);

  if (src) {
    return (
      <img
        src={src}
        alt={username}
        className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
        onError={() => setError(true)}
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center flex-shrink-0">
      <UserCircleIcon className="w-5 h-5 text-neutral-400 dark:text-neutral-500" />
    </div>
  );
}

interface ChannelListProps {
  channels: ChatChannel[];
  activeChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
  onNewChannel: () => void;
  currentUserId: string;
  userStatuses?: Record<string, string>;
}

/** Strip @[username](userId) mention syntax to just @username */
function stripMentions(text: string): string {
  return text.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
}

function formatTime(isoStr: string | null): string {
  if (!isoStr) return '';
  const dt = new Date(isoStr);
  const now = new Date();
  const diffMs = now.getTime() - dt.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Returns the status dot color and title for a user status string */
function statusDotProps(status: string): { color: string; label: string } {
  if (status === 'in_call') return { color: 'bg-orange-400', label: 'In a call' };
  if (status === 'online') return { color: 'bg-green-500', label: 'Online' };
  return { color: 'bg-neutral-300 dark:bg-gray-600', label: 'Offline' };
}

export default function ChannelListEnhanced({
  channels,
  activeChannelId,
  onSelectChannel,
  onNewChannel,
  currentUserId,
  userStatuses = {},
}: ChannelListProps) {
  const [search, setSearch] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    if (!search) return channels;
    const q = search.toLowerCase();
    return channels.filter((ch) => {
      if (ch.name?.toLowerCase().includes(q)) return true;
      if (ch.other_user?.username.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [channels, search]);

  const groupChannels = useMemo(() => filtered.filter((ch) => !ch.is_direct), [filtered]);
  const dmChannels = useMemo(() => filtered.filter((ch) => ch.is_direct), [filtered]);

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderChannel = (ch: ChatChannel) => {
    const isActive = ch.id === activeChannelId;

    // For DMs, resolve the other user's current status
    const otherMember = ch.is_direct
      ? ch.members?.find((m) => m.user_id !== currentUserId)
      : null;
    const otherUserId = otherMember?.user_id;

    // Prefer live WS status; fall back to is_online from channel data
    const liveStatus = otherUserId ? userStatuses[otherUserId] : undefined;
    const statusStr = liveStatus ?? (otherMember?.is_online ? 'online' : 'offline');
    const dot = statusDotProps(statusStr);
    const isInCall = statusStr === 'in_call';

    return (
      <button
        key={ch.id}
        onClick={() => onSelectChannel(ch.id)}
        className={`w-full group flex items-center gap-2.5 px-3 py-1.5 rounded-md text-left transition-all ${
          isActive
            ? 'bg-blue-600/20 text-neutral-900 dark:text-white'
            : 'text-neutral-600 dark:text-gray-400 hover:bg-neutral-100 dark:hover:bg-[#2a2d32] hover:text-neutral-800 dark:hover:text-gray-200'
        }`}
      >
        {/* Icon / Avatar */}
        <div className="relative flex-shrink-0">
          {ch.is_direct ? (
            <DmAvatar avatarUrl={ch.other_user?.avatar_url} username={ch.other_user?.username || '?'} />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-neutral-200 dark:bg-[#383a3f] flex items-center justify-center">
              <HashtagIcon className="w-4 h-4 text-neutral-500 dark:text-gray-400" />
            </div>
          )}
          {/* Status indicator dot for DMs */}
          {ch.is_direct && (
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-[#1a1d21] flex items-center justify-center ${dot.color}`}
              title={dot.label}
            >
              {isInCall && <PhoneIcon className="w-1.5 h-1.5 text-white" />}
            </div>
          )}
        </div>

        {/* Channel info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`text-sm truncate ${
                  ch.unread_count > 0 ? 'font-bold text-neutral-900 dark:text-white' : ''
                }`}
              >
                {ch.is_direct ? ch.other_user?.username || 'DM' : ch.name || 'Unnamed'}
              </span>
              {/* In-call label for DMs */}
              {ch.is_direct && isInCall && (
                <span className="text-[10px] text-orange-500 dark:text-orange-400 font-medium whitespace-nowrap flex-shrink-0">
                  · in a call
                </span>
              )}
            </div>
            {ch.last_message?.created_at && (
              <span className="text-[10px] text-neutral-400 dark:text-gray-600 flex-shrink-0 ml-1">
                {formatTime(ch.last_message.created_at)}
              </span>
            )}
          </div>
          {ch.last_message?.content && (
            <p className="text-[11px] text-neutral-500 dark:text-gray-500 truncate mt-0.5">
              {ch.last_message.sender_name && (
                <span className="text-neutral-600 dark:text-gray-400">{ch.last_message.sender_name}: </span>
              )}
              {stripMentions(ch.last_message.content)}
            </p>
          )}
        </div>

        {/* Unread badge */}
        {ch.unread_count > 0 && (
          <span className="flex-shrink-0 min-w-[20px] h-5 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5">
            {ch.unread_count > 99 ? '99+' : ch.unread_count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="w-[280px] bg-neutral-50 dark:bg-[#1a1d21] border-r border-neutral-200 dark:border-[#383a3f] flex flex-col h-full">
      {/* Workspace header */}
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-[#383a3f]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <ChatBubbleLeftRightIcon className="w-5 h-5 text-blue-400" />
            Messages
          </h2>
          <button
            onClick={onNewChannel}
            className="p-1.5 rounded-md bg-neutral-200 dark:bg-[#383a3f] text-neutral-600 dark:text-gray-300 hover:bg-neutral-300 dark:hover:bg-[#484b50] hover:text-neutral-900 dark:hover:text-white transition-colors"
            title="New conversation"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        </div>
        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-[#222529] border border-neutral-200 dark:border-[#383a3f] rounded-md pl-8 pr-3 py-1.5 text-xs text-neutral-700 dark:text-gray-300 placeholder-neutral-400 dark:placeholder-gray-500 focus:outline-none focus:border-neutral-400 dark:focus:border-[#565856]"
          />
        </div>
      </div>

      {/* Channel sections */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {/* Channels section */}
        {groupChannels.length > 0 && (
          <div className="mb-3">
            <button
              onClick={() => toggleSection('channels')}
              className="w-full flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-neutral-500 dark:text-gray-500 uppercase tracking-wider hover:text-neutral-700 dark:hover:text-gray-300 transition-colors"
            >
              <span className={`transform transition-transform ${collapsedSections.channels ? '-rotate-90' : ''}`}>
                ▾
              </span>
              Channels
              <span className="ml-auto text-neutral-400 dark:text-gray-600">{groupChannels.length}</span>
            </button>
            {!collapsedSections.channels && (
              <div className="mt-0.5 space-y-0.5">
                {groupChannels.map(renderChannel)}
              </div>
            )}
          </div>
        )}

        {/* Direct Messages section */}
        {dmChannels.length > 0 && (
          <div className="mb-3">
            <button
              onClick={() => toggleSection('dms')}
              className="w-full flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-neutral-500 dark:text-gray-500 uppercase tracking-wider hover:text-neutral-700 dark:hover:text-gray-300 transition-colors"
            >
              <span className={`transform transition-transform ${collapsedSections.dms ? '-rotate-90' : ''}`}>
                ▾
              </span>
              Direct Messages
              <span className="ml-auto text-neutral-400 dark:text-gray-600">{dmChannels.length}</span>
            </button>
            {!collapsedSections.dms && (
              <div className="mt-0.5 space-y-0.5">
                {dmChannels.map(renderChannel)}
              </div>
            )}
          </div>
        )}

        {channels.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-neutral-400 dark:text-gray-500">
            <ChatBubbleLeftRightIcon className="w-8 h-8 mb-2 text-neutral-300 dark:text-gray-600" />
            <p className="text-sm">No conversations yet</p>
            <button
              onClick={onNewChannel}
              className="mt-2 text-xs text-blue-400 hover:text-blue-300"
            >
              Start a conversation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
