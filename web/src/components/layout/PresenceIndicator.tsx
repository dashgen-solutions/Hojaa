"use client";

import { type OnlineUser } from "@/hooks/useWebSocket";

interface PresenceIndicatorProps {
  connected: boolean;
  onlineUsers: OnlineUser[];
}

/**
 * Shows a list of user avatars currently viewing the same session.
 * Displays a small green dot when connected, red when disconnected.
 */
export default function PresenceIndicator({ connected, onlineUsers }: PresenceIndicatorProps) {
  if (onlineUsers.length === 0 && !connected) return null;

  const MAX_SHOWN = 5;
  const shown = onlineUsers.slice(0, MAX_SHOWN);
  const extra = onlineUsers.length - MAX_SHOWN;

  return (
    <div className="flex items-center gap-2">
      {/* Connection dot */}
      <div className="relative" title={connected ? "Connected (live)" : "Reconnecting..."}>
        <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-400"}`} />
        {connected && (
          <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 animate-ping opacity-40" />
        )}
      </div>

      {/* Avatars */}
      <div className="flex -space-x-2">
        {shown.map((u) => (
          <div
            key={u.user_id}
            className="w-7 h-7 rounded-full bg-neutral-900 flex items-center justify-center border-2 border-white shadow-sm"
            title={u.username}
          >
            <span className="text-white text-[10px] font-semibold">
              {u.username?.charAt(0).toUpperCase()}
            </span>
          </div>
        ))}
        {extra > 0 && (
          <div className="w-7 h-7 rounded-full bg-neutral-200 flex items-center justify-center border-2 border-white shadow-sm">
            <span className="text-neutral-600 text-[10px] font-medium">+{extra}</span>
          </div>
        )}
      </div>

      {onlineUsers.length > 0 && (
        <span className="text-xs text-neutral-500 ml-1">
          {onlineUsers.length} online
        </span>
      )}
    </div>
  );
}
