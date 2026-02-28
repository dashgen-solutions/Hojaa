"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMessagingWebSocket, WSMessage } from "@/hooks/useMessagingWebSocket";
import {
  getChannels,
  getChannelMessages,
  sendChannelMessage,
  markChannelRead,
  ChatChannel,
  ChatMessageItem,
} from "@/lib/api";
import ChannelList from "@/components/messaging/ChannelList";
import MessageThread from "@/components/messaging/MessageThread";
import MessageComposer from "@/components/messaging/MessageComposer";
import NewChannelModal from "@/components/messaging/NewChannelModal";
import {
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";

export default function MessagesPage() {
  const { user, token, isAuthenticated } = useAuth();

  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [showNewChannelModal, setShowNewChannelModal] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, { username: string; timeout: NodeJS.Timeout }>>({});

  const selectedChannel = channels.find((c) => c.id === selectedChannelId) || null;

  // Fetch channels
  const refreshChannels = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await getChannels();
      setChannels(data);
    } catch (err) {
      console.error("Failed to fetch channels:", err);
    } finally {
      setIsLoadingChannels(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshChannels();
  }, [refreshChannels]);

  // Fetch messages when channel changes
  useEffect(() => {
    if (!selectedChannelId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      setIsLoadingMessages(true);
      try {
        const data = await getChannelMessages(selectedChannelId);
        setMessages(data);
        await markChannelRead(selectedChannelId);
        // Refresh channels to update unread count
        refreshChannels();
      } catch (err) {
        console.error("Failed to fetch messages:", err);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    loadMessages();
  }, [selectedChannelId, refreshChannels]);

  // WebSocket handlers
  const handleNewMessage = useCallback(
    (msg: WSMessage) => {
      const channelId = msg.channel_id as string;
      const message = msg.message as ChatMessageItem;

      if (channelId === selectedChannelId) {
        setMessages((prev) => [...prev, message]);
        // Auto-mark as read
        markChannelRead(channelId).catch(() => {});
      }

      // Refresh channel list for unread counts
      refreshChannels();
    },
    [selectedChannelId, refreshChannels],
  );

  const handleTyping = useCallback((msg: WSMessage) => {
    const channelId = msg.channel_id as string;
    const username = msg.username as string;
    const userId = msg.user_id as string;

    setTypingUsers((prev) => {
      // Clear existing timeout for this user in this channel
      const key = `${channelId}:${userId}`;
      if (prev[key]?.timeout) clearTimeout(prev[key].timeout);

      const timeout = setTimeout(() => {
        setTypingUsers((p) => {
          const next = { ...p };
          delete next[key];
          return next;
        });
      }, 3000);

      return { ...prev, [key]: { username, timeout } };
    });
  }, []);

  const handleMessageEdited = useCallback((msg: WSMessage) => {
    const message = msg.message as ChatMessageItem;
    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? message : m)),
    );
  }, []);

  const handleMessageDeleted = useCallback((msg: WSMessage) => {
    const messageId = msg.message_id as string;
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  const { connected, sendTyping } = useMessagingWebSocket({
    token,
    onNewMessage: handleNewMessage,
    onTyping: handleTyping,
    onChannelUpdate: refreshChannels,
    onMessageEdited: handleMessageEdited,
    onMessageDeleted: handleMessageDeleted,
    enabled: isAuthenticated,
  });

  // Send message handler
  const handleSendMessage = async (
    content: string,
    reference?: { type: string; id: string; name: string },
  ) => {
    if (!selectedChannelId) return;

    try {
      const newMsg = await sendChannelMessage(selectedChannelId, {
        content,
        reference_type: reference?.type,
        reference_id: reference?.id,
        reference_name: reference?.name,
      });
      setMessages((prev) => [...prev, newMsg]);
      refreshChannels();
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  // Channel created callback
  const handleChannelCreated = (channelId: string) => {
    setShowNewChannelModal(false);
    refreshChannels();
    setSelectedChannelId(channelId);
  };

  // Get typing users for current channel
  const currentTypingUsers = Object.entries(typingUsers)
    .filter(([key]) => key.startsWith(`${selectedChannelId}:`))
    .map(([, val]) => val.username);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full bg-neutral-50 dark:bg-[#060606]">
        <div className="text-center">
          <ChatBubbleLeftRightIcon className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
          <p className="text-neutral-500 text-sm">Please sign in to use messaging.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-neutral-50 dark:bg-[#060606]">
      {/* Channel List */}
      <div
        className="flex-shrink-0 border-r border-neutral-200 dark:border-neutral-700 flex flex-col overflow-hidden bg-[#f8f8f8] dark:bg-[#0a0a0a]"
        style={{ width: "300px" }}
      >
        <ChannelList
          channels={channels}
          selectedChannelId={selectedChannelId}
          onSelectChannel={setSelectedChannelId}
          onNewChannel={() => setShowNewChannelModal(true)}
          isLoading={isLoadingChannels}
          currentUserId={user?.id || ""}
        />
      </div>

      {/* Message Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-neutral-900">
        {selectedChannel ? (
          <>
            {/* Channel Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {selectedChannel.is_direct
                    ? selectedChannel.other_user?.username || "Direct Message"
                    : selectedChannel.name || "Group"}
                </h2>
                <p className="text-xs text-neutral-500">
                  {selectedChannel.is_direct
                    ? "Direct message"
                    : `${selectedChannel.member_count} members`}
                </p>
              </div>
              {connected && (
                <span className="flex items-center gap-1.5 text-xs text-green-600">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  Connected
                </span>
              )}
            </div>

            {/* Messages */}
            <MessageThread
              messages={messages}
              currentUserId={user?.id || ""}
              isLoading={isLoadingMessages}
              typingUsers={currentTypingUsers}
            />

            {/* Composer */}
            <MessageComposer
              onSend={handleSendMessage}
              onTyping={() => selectedChannelId && sendTyping(selectedChannelId)}
              disabled={!selectedChannelId}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <ChatBubbleLeftRightIcon className="w-16 h-16 text-neutral-200 dark:text-neutral-700 mx-auto mb-4" />
              <p className="text-neutral-500 text-sm font-medium">
                {channels.length === 0
                  ? "No conversations yet"
                  : "Select a conversation"}
              </p>
              <p className="text-neutral-400 text-xs mt-1">
                {channels.length === 0
                  ? "Start a new conversation to get going"
                  : "Choose from the left panel or start a new one"}
              </p>
              {channels.length === 0 && (
                <button
                  onClick={() => setShowNewChannelModal(true)}
                  className="mt-4 px-4 py-2 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-sm rounded-md hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
                >
                  New Conversation
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* New Channel Modal */}
      {showNewChannelModal && (
        <NewChannelModal
          onClose={() => setShowNewChannelModal(false)}
          onCreated={handleChannelCreated}
        />
      )}
    </div>
  );
}
