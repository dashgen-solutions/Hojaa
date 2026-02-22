"use client";

import { useState } from "react";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  HashtagIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { ChatChannel } from "@/lib/api";

interface ChannelListProps {
  channels: ChatChannel[];
  selectedChannelId: string | null;
  onSelectChannel: (id: string) => void;
  onNewChannel: () => void;
  isLoading: boolean;
  currentUserId: string;
}

export default function ChannelList({
  channels,
  selectedChannelId,
  onSelectChannel,
  onNewChannel,
  isLoading,
  currentUserId,
}: ChannelListProps) {
  const [search, setSearch] = useState("");

  const filtered = channels.filter((ch) => {
    if (!search) return true;
    const q = search.toLowerCase();
    if (ch.is_direct) {
      return ch.other_user?.username.toLowerCase().includes(q);
    }
    return ch.name?.toLowerCase().includes(q);
  });

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-200 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-neutral-900">Messages</h2>
          <button
            onClick={onNewChannel}
            className="p-1.5 rounded-md hover:bg-neutral-200 transition-colors text-neutral-600"
            title="New conversation"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-md focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-200"
          />
        </div>
      </div>

      {/* Channel List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 px-4">
            <p className="text-xs text-neutral-400">
              {search ? "No matching conversations" : "No conversations yet"}
            </p>
          </div>
        ) : (
          <div className="py-1">
            {filtered.map((ch) => {
              const isSelected = ch.id === selectedChannelId;
              const displayName = ch.is_direct
                ? ch.other_user?.username || "Unknown"
                : ch.name || "Unnamed Group";
              const initial = displayName.charAt(0).toUpperCase();

              return (
                <button
                  key={ch.id}
                  onClick={() => onSelectChannel(ch.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    isSelected
                      ? "bg-neutral-200"
                      : "hover:bg-neutral-100"
                  }`}
                >
                  {/* Avatar / Icon */}
                  <div className="flex-shrink-0">
                    {ch.is_direct ? (
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                        <span className="text-white text-xs font-semibold">{initial}</span>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-neutral-300 flex items-center justify-center">
                        <HashtagIcon className="w-4 h-4 text-neutral-600" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-[13px] truncate ${
                        ch.unread_count > 0 ? "font-semibold text-neutral-900" : "text-neutral-700"
                      }`}>
                        {displayName}
                      </span>
                      {ch.last_message?.created_at && (
                        <span className="text-[10px] text-neutral-400 flex-shrink-0 ml-2">
                          {formatTime(ch.last_message.created_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-[11px] text-neutral-500 truncate">
                        {ch.last_message
                          ? `${ch.last_message.sender_name}: ${ch.last_message.content}`
                          : "No messages yet"}
                      </p>
                      {ch.unread_count > 0 && (
                        <span className="flex-shrink-0 ml-2 bg-blue-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                          {ch.unread_count > 9 ? "9+" : ch.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
