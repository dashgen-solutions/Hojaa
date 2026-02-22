"use client";

import { useEffect, useRef } from "react";
import { ChatMessageItem } from "@/lib/api";
import ProjectReference from "./ProjectReference";

interface MessageThreadProps {
  messages: ChatMessageItem[];
  currentUserId: string;
  isLoading: boolean;
  typingUsers: string[];
}

export default function MessageThread({
  messages,
  currentUserId,
  isLoading,
  typingUsers,
}: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  const formatDateSeparator = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return "Today";
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: ChatMessageItem[] }[] = [];
  let currentDate = "";
  for (const msg of messages) {
    const msgDate = new Date(msg.created_at).toDateString();
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groupedMessages.push({ date: msg.created_at, messages: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  }

  const avatarColors = [
    "bg-blue-600", "bg-purple-600", "bg-green-600", "bg-amber-600",
    "bg-rose-600", "bg-cyan-600", "bg-indigo-600", "bg-teal-600",
  ];

  const getAvatarColor = (senderId: string | null) => {
    if (!senderId) return "bg-neutral-400";
    const hash = senderId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return avatarColors[hash % avatarColors.length];
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-5 py-4">
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-neutral-400 text-xs">No messages yet. Say hello!</p>
        </div>
      ) : (
        <>
          {groupedMessages.map((group, gi) => (
            <div key={gi}>
              {/* Date separator */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-neutral-200" />
                <span className="text-[11px] text-neutral-400 font-medium">
                  {formatDateSeparator(group.date)}
                </span>
                <div className="flex-1 h-px bg-neutral-200" />
              </div>

              {/* Messages */}
              {group.messages.map((msg, mi) => {
                const isOwn = msg.sender_id === currentUserId;
                const showAvatar =
                  mi === 0 ||
                  group.messages[mi - 1].sender_id !== msg.sender_id;

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${showAvatar ? "mt-3" : "mt-0.5"}`}
                  >
                    {/* Avatar */}
                    <div className="w-7 flex-shrink-0">
                      {showAvatar && (
                        <div
                          className={`w-7 h-7 rounded-full ${getAvatarColor(msg.sender_id)} flex items-center justify-center`}
                        >
                          <span className="text-white text-[10px] font-semibold">
                            {msg.sender_name?.charAt(0).toUpperCase() || "?"}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Message content */}
                    <div className="flex-1 min-w-0">
                      {showAvatar && (
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className={`text-[13px] font-semibold ${isOwn ? "text-blue-700" : "text-neutral-900"}`}>
                            {isOwn ? "You" : msg.sender_name}
                          </span>
                          <span className="text-[10px] text-neutral-400">
                            {formatTime(msg.created_at)}
                          </span>
                          {msg.is_edited && (
                            <span className="text-[10px] text-neutral-400 italic">(edited)</span>
                          )}
                        </div>
                      )}
                      <p className="text-[13px] text-neutral-700 leading-relaxed whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>

                      {/* Project Reference */}
                      {msg.reference_type && msg.reference_id && (
                        <ProjectReference
                          type={msg.reference_type}
                          id={msg.reference_id}
                          name={msg.reference_name || "Unknown"}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </>
      )}

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="flex items-center gap-2 mt-3 px-9">
          <div className="flex gap-0.5">
            <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <span className="text-[11px] text-neutral-400 italic">
            {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
          </span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
