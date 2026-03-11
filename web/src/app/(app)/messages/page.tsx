'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMessagingWebSocket, WSMessage } from '@/hooks/useMessagingWebSocket';
import {
  getChannels,
  getChannelMessages,
  sendChannelMessage,
  markChannelRead,
  getPinnedMessages,
  getMyStatus,
  updateMyStatus,
  uploadCallRecording,
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
import CallOverlay from '@/components/messaging/CallOverlay';
import GroupMembersPanel from '@/components/messaging/GroupMembersPanel';
import StatusPicker from '@/components/messaging/StatusPicker';
import MessagingChatbot from '@/components/messaging/MessagingChatbot';
import { useWebRTCCall } from '@/hooks/useWebRTCCall';
import {
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  HashtagIcon,
  XMarkIcon,
  PhoneIcon,
  VideoCameraIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

/** Strip @[username](userId) mention syntax to just @username */
function stripMentions(text: string): string {
  return text.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
}

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
  const [showMembers, setShowMembers] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessageItem[]>([]);
  const [replyTo, setReplyTo] = useState<{ id: string; sender_name: string; content: string } | null>(null);

  // User status (Slack-style)
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [myStatus, setMyStatus] = useState<string | null>(null);
  const [myStatusEmoji, setMyStatusEmoji] = useState<string | null>(null);

  // Huddle state removed (not implemented)

  const statusBarRef = useRef<HTMLDivElement>(null);
  const [statusPickerPos, setStatusPickerPos] = useState<{ bottom: number; left: number } | null>(null);

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

  // Load user status on mount
  useEffect(() => {
    if (!isAuthenticated) return;
    getMyStatus()
      .then((s) => {
        setMyStatus(s.custom_status || null);
        setMyStatusEmoji(s.status_emoji || null);
      })
      .catch(() => {});
  }, [isAuthenticated]);

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
    setShowMembers(false);
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
      // Also update custom_status/status_emoji in channels
      if (msg.custom_status !== undefined || msg.status_emoji !== undefined) {
        setChannels((prev) =>
          prev.map((ch) => ({
            ...ch,
            members: ch.members.map((m) =>
              m.user_id === userId
                ? { ...m, custom_status: msg.custom_status as string | null, status_emoji: msg.status_emoji as string | null }
                : m,
            ),
          })),
        );
      }
      refreshChannels();
    },
    [refreshChannels],
  );

  const handleStatusUpdate = useCallback(
    (msg: WSMessage) => {
      const userId = msg.user_id as string;
      const customStatus = (msg.custom_status as string) || null;
      const statusEmoji = (msg.status_emoji as string) || null;
      // Update member info in all channels
      setChannels((prev) =>
        prev.map((ch) => ({
          ...ch,
          members: ch.members.map((m) =>
            m.user_id === userId
              ? { ...m, custom_status: customStatus, status_emoji: statusEmoji }
              : m,
          ),
        })),
      );
    },
    [],
  );

  const handleMessagePinned = useCallback(
    (_msg: WSMessage) => {
      if (selectedChannelId) {
        getChannelMessages(selectedChannelId).then(setMessages).catch(() => {});
      }
    },
    [selectedChannelId],
  );

  // ---- WebRTC call hook ----
  // Use a ref so the call hook always has the latest sendWsMessage without re-renders.
  const sendWsFnRef = React.useRef<(data: Record<string, unknown>) => void>(() => {});
  const stableSendWs = useCallback((data: Record<string, unknown>) => {
    sendWsFnRef.current(data);
  }, []);

  const webrtcCall = useWebRTCCall({ currentUserId: user?.id || '', currentUserName: user?.username || '', sendWsMessage: stableSendWs });

  const { connected, sendTyping, sendWsMessage } = useMessagingWebSocket({
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
    onCallIncoming: webrtcCall.handleCallIncoming,
    onCallAccepted: webrtcCall.handleCallAccepted,
    onCallRejected: webrtcCall.handleCallRejected,
    onCallEnded: webrtcCall.handleCallEnded,
    onWebRTCOffer: webrtcCall.handleWebRTCOffer,
    onWebRTCAnswer: webrtcCall.handleWebRTCAnswer,
    onWebRTCIceCandidate: webrtcCall.handleWebRTCIceCandidate,
    onGroupCallParticipantJoined: webrtcCall.handleGroupCallParticipantJoined,
    onGroupCallParticipantLeft: webrtcCall.handleGroupCallParticipantLeft,
    onStatusUpdate: handleStatusUpdate,
    enabled: isAuthenticated,
  });

  // Wire up the send function now that we have it from the WS hook
  sendWsFnRef.current = sendWsMessage;

  // ---- Auto-upload call recording for transcription ----
  const transcriptionUploadedRef = useRef(false);

  useEffect(() => {
    // When a call ends and there's a recording blob, upload it for transcription
    if (
      webrtcCall.callState === 'idle' &&
      webrtcCall.recordingBlob &&
      selectedChannelId &&
      !transcriptionUploadedRef.current
    ) {
      transcriptionUploadedRef.current = true;
      const callType = webrtcCall.callInfo?.callType || 'audio';
      const duration = webrtcCall.callDuration || 0;

      uploadCallRecording(selectedChannelId, webrtcCall.recordingBlob, callType, duration)
        .then((res) => {
          console.log('Call transcription saved:', res.status, res.transcription_text?.slice(0, 100));
        })
        .catch((err) => {
          console.error('Failed to upload call recording:', err);
        })
        .finally(() => {
          webrtcCall.clearRecording();
        });
    }

    // Reset the ref when a new call starts
    if (webrtcCall.callState !== 'idle') {
      transcriptionUploadedRef.current = false;
    }
  }, [webrtcCall.callState, webrtcCall.recordingBlob, selectedChannelId]);

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
      <div className="flex items-center justify-center h-full bg-white dark:bg-[#1e2024]">
        <div className="text-center">
          <ChatBubbleLeftRightIcon className="w-12 h-12 text-neutral-400 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-neutral-500 dark:text-gray-400 text-sm">Please sign in to use messaging.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-white dark:bg-[#1e2024]">
      {/* Channel sidebar */}
      <div className="flex flex-col h-full">
        <ChannelListEnhanced
          channels={channels}
          activeChannelId={selectedChannelId}
          onSelectChannel={setSelectedChannelId}
          onNewChannel={() => setShowNewChannelModal(true)}
          currentUserId={user?.id || ''}
        />
        {/* User status bar at bottom of sidebar */}
        <div ref={statusBarRef} className="relative border-t border-neutral-200 dark:border-[#383a3f] bg-white dark:bg-[#1a1d21] px-3 py-2">
          <button
            onClick={() => {
              if (!showStatusPicker && statusBarRef.current) {
                const rect = statusBarRef.current.getBoundingClientRect();
                setStatusPickerPos({
                  bottom: window.innerHeight - rect.top + 8,
                  left: rect.left,
                });
              }
              setShowStatusPicker(!showStatusPicker);
            }}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left hover:bg-neutral-100 dark:hover:bg-[#2a2d32] transition-colors group"
            title="Set your status"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {(user?.username || '?')[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-800 dark:text-gray-200 truncate">{user?.username || 'Me'}</p>
              {(myStatus || myStatusEmoji) ? (
                <p className="text-[11px] text-neutral-500 dark:text-gray-400 truncate">
                  {myStatusEmoji && <span className="mr-1">{myStatusEmoji}</span>}
                  {myStatus}
                </p>
              ) : (
                <p className="text-[11px] text-neutral-400 dark:text-gray-600 group-hover:text-neutral-500 dark:group-hover:text-gray-500">Set a status</p>
              )}
            </div>
          </button>
          {showStatusPicker && statusPickerPos && createPortal(
            <div className="fixed" style={{ bottom: statusPickerPos.bottom, left: statusPickerPos.left, zIndex: 9999 }}>
              <StatusPicker
                currentStatus={myStatus}
                currentEmoji={myStatusEmoji}
                onSave={async (status, emoji) => {
                  try {
                    const res = await updateMyStatus({ custom_status: status, status_emoji: emoji });
                    setMyStatus(res.custom_status || null);
                    setMyStatusEmoji(res.status_emoji || null);
                  } catch {
                    // ignore
                  }
                  setShowStatusPicker(false);
                }}
                onClose={() => setShowStatusPicker(false)}
              />
            </div>,
            document.body
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#1e2024]">
        {selectedChannel ? (
          <>
            {/* Channel header */}
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-neutral-200 dark:border-[#383a3f] flex-shrink-0 bg-white dark:bg-[#1e2024]">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div>
                  <div className="flex items-center gap-2">
                    {!selectedChannel.is_direct && <HashtagIcon className="w-4 h-4 text-neutral-400 dark:text-gray-400" />}
                    <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
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
                    <p className="text-[11px] text-neutral-500 dark:text-gray-500 truncate mt-0.5 max-w-[400px]">{selectedChannel.topic}</p>
                  ) : selectedChannel.is_direct ? (
                    (() => {
                      const otherMember = selectedChannel.members.find((m) => m.user_id !== user?.id);
                      if (otherMember?.custom_status || otherMember?.status_emoji) {
                        return (
                          <p className="text-[11px] text-neutral-500 dark:text-gray-500 truncate mt-0.5 max-w-[400px]">
                            {otherMember.status_emoji && <span className="mr-1">{otherMember.status_emoji}</span>}
                            {otherMember.custom_status}
                          </p>
                        );
                      }
                      return null;
                    })()
                  ) : (
                    <p className="text-[11px] text-neutral-400 dark:text-gray-600 mt-0.5">
                      {selectedChannel.member_count} member{selectedChannel.member_count !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={loadPins}
                  className={`p-2 rounded-md transition-colors ${
                    showPins ? 'bg-yellow-600/20 text-yellow-400' : 'text-neutral-400 dark:text-gray-400 hover:text-neutral-600 dark:hover:text-gray-200 hover:bg-neutral-100 dark:hover:bg-[#383a3f]'
                  }`}
                  title="Pinned messages"
                >
                  <MapPinIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setShowSearch(!showSearch); setShowPins(false); setThreadMessage(null); }}
                  className={`p-2 rounded-md transition-colors ${
                    showSearch ? 'bg-blue-600/20 text-blue-400' : 'text-neutral-400 dark:text-gray-400 hover:text-neutral-600 dark:hover:text-gray-200 hover:bg-neutral-100 dark:hover:bg-[#383a3f]'
                  }`}
                  title="Search messages"
                >
                  <MagnifyingGlassIcon className="w-4 h-4" />
                </button>

                {/* Audio call — DM or Group */}
                {(selectedChannel.is_direct ? selectedChannel.other_user : !selectedChannel.is_direct) && (
                  <button
                    onClick={() => {
                      if (selectedChannel.is_direct && selectedChannel.other_user) {
                        webrtcCall.startCall(
                          selectedChannel.other_user.user_id,
                          selectedChannel.other_user.username,
                          selectedChannel.id,
                          'audio',
                        );
                      } else if (!selectedChannel.is_direct && selectedChannel.members) {
                        webrtcCall.startGroupCall(
                          selectedChannel.members.map((m) => m.user_id),
                          selectedChannel.id,
                          selectedChannel.name || 'Group',
                          'audio',
                        );
                      }
                    }}
                    className="p-2 rounded-md text-neutral-400 dark:text-gray-400 hover:text-neutral-600 dark:hover:text-gray-200 hover:bg-neutral-100 dark:hover:bg-[#383a3f] transition-colors"
                    title={selectedChannel.is_direct ? 'Audio call' : 'Group audio call'}
                    disabled={webrtcCall.callState !== 'idle'}
                  >
                    <PhoneIcon className="w-4 h-4" />
                  </button>
                )}
                {/* Video call — DM or Group */}
                {(selectedChannel.is_direct ? selectedChannel.other_user : !selectedChannel.is_direct) && (
                  <button
                    onClick={() => {
                      if (selectedChannel.is_direct && selectedChannel.other_user) {
                        webrtcCall.startCall(
                          selectedChannel.other_user.user_id,
                          selectedChannel.other_user.username,
                          selectedChannel.id,
                          'video',
                        );
                      } else if (!selectedChannel.is_direct && selectedChannel.members) {
                        webrtcCall.startGroupCall(
                          selectedChannel.members.map((m) => m.user_id),
                          selectedChannel.id,
                          selectedChannel.name || 'Group',
                          'video',
                        );
                      }
                    }}
                    className="p-2 rounded-md text-neutral-400 dark:text-gray-400 hover:text-neutral-600 dark:hover:text-gray-200 hover:bg-neutral-100 dark:hover:bg-[#383a3f] transition-colors"
                    title={selectedChannel.is_direct ? 'Video call' : 'Group video call'}
                    disabled={webrtcCall.callState !== 'idle'}
                  >
                    <VideoCameraIcon className="w-4 h-4" />
                  </button>
                )}

                {/* Members button — group channels only */}
                {!selectedChannel.is_direct && (
                  <button
                    onClick={() => { setShowMembers(!showMembers); setShowSearch(false); setShowPins(false); setThreadMessage(null); }}
                    className={`p-2 rounded-md transition-colors ${
                      showMembers ? 'bg-blue-600/20 text-blue-400' : 'text-neutral-400 dark:text-gray-400 hover:text-neutral-600 dark:hover:text-gray-200 hover:bg-neutral-100 dark:hover:bg-[#383a3f]'
                    }`}
                    title="Members"
                  >
                    <UserGroupIcon className="w-4 h-4" />
                  </button>
                )}

                <div className="ml-2 flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
                </div>
              </div>
            </div>

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
              <ChatBubbleLeftRightIcon className="w-16 h-16 text-neutral-300 dark:text-gray-700 mx-auto mb-4" />
              <p className="text-neutral-500 dark:text-gray-400 text-base font-medium">
                {channels.length === 0 ? 'No conversations yet' : 'Select a conversation'}
              </p>
              <p className="text-neutral-400 dark:text-gray-600 text-sm mt-1">
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
        <div className="w-[350px] border-l border-neutral-200 dark:border-[#383a3f] bg-white dark:bg-[#1e2024] flex flex-col h-full">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-[#383a3f]">
            <div className="flex items-center gap-2">
              <MapPinIcon className="w-5 h-5 text-yellow-400" />
              <h3 className="text-sm font-bold text-neutral-800 dark:text-gray-200">Pinned Messages</h3>
            </div>
            <button onClick={() => setShowPins(false)} className="p-1 rounded text-neutral-400 dark:text-gray-400 hover:text-neutral-600 dark:hover:text-gray-200 hover:bg-neutral-100 dark:hover:bg-[#383a3f] transition-colors">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {pinnedMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-neutral-400 dark:text-gray-500">
                <MapPinIcon className="w-8 h-8 mb-2 text-neutral-300 dark:text-gray-600" />
                <p className="text-sm">No pinned messages</p>
              </div>
            ) : (
              pinnedMessages.map((pin) => (
                <div key={pin.id} className="px-4 py-3 border-b border-neutral-100 dark:border-[#383a3f]/30 hover:bg-neutral-50 dark:hover:bg-[#222529]">
                  {pin.message && (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-neutral-700 dark:text-gray-300">{pin.message.sender_name}</span>
                        <span className="text-[10px] text-neutral-400 dark:text-gray-600">
                          {new Date(pin.message.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-[13px] text-neutral-500 dark:text-gray-400 line-clamp-3">{stripMentions(pin.message.content)}</p>
                      <p className="text-[10px] text-neutral-400 dark:text-gray-600 mt-1">Pinned by {pin.pinned_by}</p>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Group members panel (right side) */}
      {showMembers && selectedChannel && !selectedChannel.is_direct && (
        <GroupMembersPanel
          members={selectedChannel.members || []}
          onClose={() => setShowMembers(false)}
          channelName={selectedChannel.name || 'Group'}
          channelId={selectedChannel.id}
          onMembersChanged={refreshChannels}
        />
      )}

      {/* New channel modal */}
      {showNewChannelModal && (
        <NewChannelModal onClose={() => setShowNewChannelModal(false)} onCreated={handleChannelCreated} />
      )}

      {/* Call overlay */}
      {webrtcCall.callState !== 'idle' && webrtcCall.callInfo && (
        <CallOverlay
          callState={webrtcCall.callState}
          callType={webrtcCall.callInfo.callType}
          remoteUserName={webrtcCall.callInfo.remoteUserName}
          isCaller={webrtcCall.callInfo.isCaller}
          isGroup={webrtcCall.callInfo.isGroup}
          isMuted={webrtcCall.isMuted}
          isVideoOff={webrtcCall.isVideoOff}
          callDuration={webrtcCall.callDuration}
          participants={webrtcCall.participants}
          localVideoRef={webrtcCall.localVideoRef}
          remoteVideoRef={webrtcCall.remoteVideoRef}
          remoteAudioRef={webrtcCall.remoteAudioRef}
          onAccept={() => {
            if (webrtcCall.callInfo?.isGroup) {
              webrtcCall.acceptGroupCall(webrtcCall.callInfo.remoteUserId);
            } else {
              webrtcCall.acceptCall(webrtcCall.callInfo!.remoteUserId);
            }
          }}
          onReject={webrtcCall.rejectCall}
          onHangUp={webrtcCall.endCall}
          onToggleMute={webrtcCall.toggleMute}
          onToggleVideo={webrtcCall.toggleVideo}
          isRecording={webrtcCall.isRecording}
          onToggleRecording={() =>
            webrtcCall.isRecording ? webrtcCall.stopRecording() : webrtcCall.startRecording()
          }
        />
      )}

      {/* Messaging AI chatbot */}
      {selectedChannelId && <MessagingChatbot channelId={selectedChannelId} />}
    </div>
  );
}
