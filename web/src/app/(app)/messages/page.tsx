'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMessagingWebSocket, WSMessage } from '@/hooks/useMessagingWebSocket';
import {
  getChannels,
  getChannelMessages,
  sendChannelMessage,
  markChannelRead,
  getPinnedMessages,
  ChatChannel,
  ChatMessageItem,
  PinnedMessageItem,
} from '@/lib/api';
import ChannelListEnhanced from '@/components/messaging/ChannelListEnhanced';
import MessageThreadEnhanced from '@/components/messaging/MessageThreadEnhanced';
import MessageComposerEnhanced from '@/components/messaging/MessageComposerEnhanced';
import NewChannelModal from '@/components/messaging/NewChannelModal';
import ThreadPanel from '@/components/messaging/ThreadPanel';
import MessageSearch from '@/components/messaging/MessageSearch';
import {
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  UserGroupIcon,
  MapPinIcon,
  HashtagIcon,
  XMarkIcon,
  SignalIcon,
} from '@heroicons/react/24/outline';

export default function MessagesPage() {
  const { user, token, isAuthenticated } = useAuth();

  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [showNewChannelModal, setShowNewChannelModal] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, { username: string; timeout: NodeJS.Timeout }>>({});
  const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({});

  // Side panels
  const [threadMessage, setThreadMessage] = useState<ChatMessageItem | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showPins, setShowPins] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessageItem[]>([]);
  const [replyTo, setReplyTo] = useState<{ id: string; sender_name: string; content: string } | null>(null);

  // Huddle state (UI only)
  const [huddleActive, setHuddleActive] = useState(false);

  const selectedChannel = channels.find((c) => c.id === selectedChannelId) || null;

  // ---- data fetching ----

  const refreshChannels = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await getChannels();
      setChannels(data);
    } catch (err) {
      console.error('Failed to fetch channels:', err);
    } finally {
      setIsLoadingChannels(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshChannels();
  }, [refreshChannels]);

  useEffect(() => {
    if (!selectedChannelId) {
      setMessages([]);
      return;
    }
    const load = async () => {
      setIsLoadingMessages(true);
      try {
        const data = await getChannelMessages(selectedChannelId);
        setMessages(data);
        await markChannelRead(selectedChannelId);
        refreshChannels();
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      } finally {
        setIsLoadingMessages(false);
      }
    };
    load();
    // Reset side panels on channel switch
    setThreadMessage(null);
    setShowPins(false);
    setReplyTo(null);
  }, [selectedChannelId, refreshChannels]);

  // ---- WebSocket handlers ----

  const handleNewMessage = useCallback(
    (msg: WSMessage) => {
      const channelId = msg.channel_id as string;
      const message = msg.message as ChatMessageItem;
      if (channelId === selectedChannelId) {
        setMessages((prev) => [...prev, message]);
        markChannelRead(channelId).catch(() => {});
      }
      refreshChannels();
    },
    [selectedChannelId, refreshChannels],
  );

  const handleTyping = useCallback((msg: WSMessage) => {
    const channelId = msg.channel_id as string;
    const username = msg.username as string;
    const userId = msg.user_id as string;
    setTypingUsers((prev) => {
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
    setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
  }, []);

  const handleMessageDeleted = useCallback((msg: WSMessage) => {
    const messageId = msg.message_id as string;
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  const handleReactionAdded = useCallback((msg: WSMessage) => {
    const messageId = msg.message_id as string;
    const emoji = msg.emoji as string;
    const userId = msg.user_id as string;
    const username = msg.username as string;
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = [...(m.reactions || [])];
        const existing = reactions.find((r) => r.emoji === emoji);
        if (existing) {
          existing.count += 1;
          existing.users.push({ user_id: userId, username });
        } else {
          reactions.push({ emoji, count: 1, users: [{ user_id: userId, username }] });
        }
        return { ...m, reactions };
      }),
    );
  }, []);

  const handleReactionRemoved = useCallback((msg: WSMessage) => {
    const messageId = msg.message_id as string;
    const emoji = msg.emoji as string;
    const userId = msg.user_id as string;
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        let reactions = [...(m.reactions || [])];
        const existing = reactions.find((r) => r.emoji === emoji);
        if (existing) {
          existing.count -= 1;
          existing.users = existing.users.filter((u) => u.user_id !== userId);
          if (existing.count <= 0) reactions = reactions.filter((r) => r.emoji !== emoji);
        }
        return { ...m, reactions };
      }),
    );
  }, []);

  const handleThreadReply = useCallback(
    (msg: WSMessage) => {
      const channelId = msg.channel_id as string;
      const message = msg.message as ChatMessageItem;
      if (channelId === selectedChannelId && message.parent_message_id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === message.parent_message_id
              ? { ...m, thread_reply_count: (m.thread_reply_count || 0) + 1 }
              : m,
          ),
        );
      }
      refreshChannels();
    },
    [selectedChannelId, refreshChannels],
  );

  const handlePresence = useCallback(
    (msg: WSMessage) => {
      const userId = msg.user_id as string;
      const status = msg.status as string;
      setOnlineUsers((prev) => ({ ...prev, [userId]: status === 'online' }));
      refreshChannels();
    },
    [refreshChannels],
  );

  const handleMessagePinned = useCallback(
    (_msg: WSMessage) => {
      if (selectedChannelId) {
        getChannelMessages(selectedChannelId).then(setMessages).catch(() => {});
      }
    },
    [selectedChannelId],
  );

  const { connected, sendTyping } = useMessagingWebSocket({
    token,
    onNewMessage: handleNewMessage,
    onTyping: handleTyping,
    onChannelUpdate: refreshChannels,
    onMessageEdited: handleMessageEdited,
    onMessageDeleted: handleMessageDeleted,
    onReactionAdded: handleReactionAdded,
    onReactionRemoved: handleReactionRemoved,
    onThreadReply: handleThreadReply,
    onPresence: handlePresence,
    onMessagePinned: handleMessagePinned,
    enabled: isAuthenticated,
  });

  // ---- actions ----

  const handleSendMessage = async (
    content: string,
    options?: {
      reference?: { type: string; id: string; name: string };
      parent_message_id?: string;
      mentions?: string[];
    },
  ) => {
    if (!selectedChannelId) return;
    try {
      const newMsg = await sendChannelMessage(selectedChannelId, {
        content,
        reference_type: options?.reference?.type,
        reference_id: options?.reference?.id,
        reference_name: options?.reference?.name,
        parent_message_id: options?.parent_message_id,
        mentions: options?.mentions,
      });
      if (!options?.parent_message_id) {
        setMessages((prev) => [...prev, newMsg]);
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === options.parent_message_id
              ? { ...m, thread_reply_count: (m.thread_reply_count || 0) + 1 }
              : m,
          ),
        );
      }
      refreshChannels();
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleChannelCreated = (channelId: string) => {
    setShowNewChannelModal(false);
    refreshChannels();
    setSelectedChannelId(channelId);
  };

  const handleOpenThread = (msg: ChatMessageItem) => {
    setThreadMessage(msg);
    setShowSearch(false);
    setShowPins(false);
  };

  const handleReply = (msg: ChatMessageItem) => {
    setReplyTo({ id: msg.id, sender_name: msg.sender_name, content: msg.content.substring(0, 100) });
  };

  const handleMessageUpdate = (updated: ChatMessageItem) => {
    setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  };

  const handleMessageDelete = (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  const loadPins = async () => {
    if (!selectedChannelId) return;
    try {
      const pins = await getPinnedMessages(selectedChannelId);
      setPinnedMessages(pins);
      setShowPins(true);
      setShowSearch(false);
      setThreadMessage(null);
    } catch {
      // ignore
    }
  };

  const currentTypingUsers = Object.entries(typingUsers)
    .filter(([key]) => key.startsWith(`${selectedChannelId}:`))
    .map(([, val]) => val.username);

  // ---- render ----

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1e2024]">
        <div className="text-center">
          <ChatBubbleLeftRightIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Please sign in to use messaging.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-[#1e2024]">
      {/* Channel sidebar */}
      <ChannelListEnhanced
        channels={channels}
        activeChannelId={selectedChannelId}
        onSelectChannel={setSelectedChannelId}
        onNewChannel={() => setShowNewChannelModal(true)}
        currentUserId={user?.id || ''}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#1e2024]">
        {selectedChannel ? (
          <>
            {/* Channel header */}
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-[#383a3f] flex-shrink-0 bg-[#1e2024]">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div>
                  <div className="flex items-center gap-2">
                    {!selectedChannel.is_direct && <HashtagIcon className="w-4 h-4 text-gray-400" />}
                    <h2 className="text-sm font-bold text-white">
                      {selectedChannel.is_direct
                        ? selectedChannel.other_user?.username || 'Direct Message'
                        : selectedChannel.name || 'Group'}
                    </h2>
                    {selectedChannel.is_direct &&
                      selectedChannel.members?.some((m) => m.user_id !== user?.id && m.is_online) && (
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                      )}
                  </div>
                  {selectedChannel.topic ? (
                    <p className="text-[11px] text-gray-500 truncate mt-0.5 max-w-[400px]">{selectedChannel.topic}</p>
                  ) : (
                    !selectedChannel.is_direct && (
                      <p className="text-[11px] text-gray-600 mt-0.5">
                        {selectedChannel.member_count} member{selectedChannel.member_count !== 1 ? 's' : ''}
                      </p>
                    )
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setHuddleActive(!huddleActive)}
                  className={`p-2 rounded-md transition-colors ${
                    huddleActive ? 'bg-green-600/20 text-green-400' : 'text-gray-400 hover:text-gray-200 hover:bg-[#383a3f]'
                  }`}
                  title={huddleActive ? 'Leave huddle' : 'Start huddle'}
                >
                  <SignalIcon className="w-4 h-4" />
                </button>
                <button className="p-2 rounded-md text-gray-400 hover:text-gray-200 hover:bg-[#383a3f] transition-colors" title="Start call">
                  <PhoneIcon className="w-4 h-4" />
                </button>
                <button className="p-2 rounded-md text-gray-400 hover:text-gray-200 hover:bg-[#383a3f] transition-colors" title="View members">
                  <UserGroupIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={loadPins}
                  className={`p-2 rounded-md transition-colors ${
                    showPins ? 'bg-yellow-600/20 text-yellow-400' : 'text-gray-400 hover:text-gray-200 hover:bg-[#383a3f]'
                  }`}
                  title="Pinned messages"
                >
                  <MapPinIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setShowSearch(!showSearch); setShowPins(false); setThreadMessage(null); }}
                  className={`p-2 rounded-md transition-colors ${
                    showSearch ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:text-gray-200 hover:bg-[#383a3f]'
                  }`}
                  title="Search messages"
                >
                  <MagnifyingGlassIcon className="w-4 h-4" />
                </button>
                <div className="ml-2 flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
                </div>
              </div>
            </div>

            {/* Huddle bar */}
            {huddleActive && (
              <div className="flex items-center gap-3 px-5 py-2 bg-green-600/10 border-b border-green-600/20">
                <SignalIcon className="w-4 h-4 text-green-400 animate-pulse" />
                <span className="text-xs text-green-400 font-medium">Huddle active</span>
                <span className="text-xs text-gray-500">
                  {selectedChannel.is_direct ? selectedChannel.other_user?.username : `${selectedChannel.member_count} members`}
                </span>
                <div className="flex-1" />
                <button onClick={() => setHuddleActive(false)} className="text-xs text-red-400 hover:text-red-300 font-medium">
                  Leave
                </button>
              </div>
            )}

            {/* Messages */}
            {isLoadingMessages ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <MessageThreadEnhanced
                messages={messages}
                currentUserId={user?.id || ''}
                typingUsers={currentTypingUsers}
                onOpenThread={handleOpenThread}
                onReply={handleReply}
                onMessageUpdate={handleMessageUpdate}
                onMessageDelete={handleMessageDelete}
              />
            )}

            {/* Composer */}
            <MessageComposerEnhanced
              channelId={selectedChannelId || ''}
              onSend={handleSendMessage}
              onTyping={() => selectedChannelId && sendTyping(selectedChannelId)}
              disabled={!selectedChannelId}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <ChatBubbleLeftRightIcon className="w-16 h-16 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-400 text-base font-medium">
                {channels.length === 0 ? 'No conversations yet' : 'Select a conversation'}
              </p>
              <p className="text-gray-600 text-sm mt-1">
                {channels.length === 0 ? 'Start a new conversation to get going' : 'Choose from the sidebar or start a new one'}
              </p>
              {channels.length === 0 && (
                <button
                  onClick={() => setShowNewChannelModal(true)}
                  className="mt-4 px-5 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-500 transition-colors"
                >
                  New Conversation
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Thread panel (right side) */}
      {threadMessage && selectedChannelId && (
        <ThreadPanel
          parentMessage={threadMessage}
          channelId={selectedChannelId}
          currentUserId={user?.id || ''}
          onClose={() => setThreadMessage(null)}
          onNewReply={() => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === threadMessage.id ? { ...m, thread_reply_count: (m.thread_reply_count || 0) + 1 } : m,
              ),
            );
          }}
        />
      )}

      {/* Search panel (right side) */}
      {showSearch && (
        <MessageSearch
          channelId={selectedChannelId || undefined}
          onSelectMessage={(msg) => {
            if (msg.channel_id !== selectedChannelId) setSelectedChannelId(msg.channel_id);
            setShowSearch(false);
          }}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* Pinned messages panel (right side) */}
      {showPins && selectedChannelId && (
        <div className="w-[350px] border-l border-[#383a3f] bg-[#1e2024] flex flex-col h-full">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#383a3f]">
            <div className="flex items-center gap-2">
              <MapPinIcon className="w-5 h-5 text-yellow-400" />
              <h3 className="text-sm font-bold text-gray-200">Pinned Messages</h3>
            </div>
            <button onClick={() => setShowPins(false)} className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-[#383a3f] transition-colors">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {pinnedMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <MapPinIcon className="w-8 h-8 mb-2 text-gray-600" />
                <p className="text-sm">No pinned messages</p>
              </div>
            ) : (
              pinnedMessages.map((pin) => (
                <div key={pin.id} className="px-4 py-3 border-b border-[#383a3f]/30 hover:bg-[#222529]">
                  {pin.message && (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-300">{pin.message.sender_name}</span>
                        <span className="text-[10px] text-gray-600">
                          {new Date(pin.message.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-[13px] text-gray-400 line-clamp-3">{pin.message.content}</p>
                      <p className="text-[10px] text-gray-600 mt-1">Pinned by {pin.pinned_by}</p>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* New channel modal */}
      {showNewChannelModal && (
        <NewChannelModal onClose={() => setShowNewChannelModal(false)} onCreated={handleChannelCreated} />
      )}
    </div>
  );
}
