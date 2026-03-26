'use client';

/**
 * Global messaging WebSocket + WebRTC calls so incoming calls work on any app route,
 * not only on /messages.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMessagingWebSocket, type WSMessage } from '@/hooks/useMessagingWebSocket';
import { useWebRTCCall } from '@/hooks/useWebRTCCall';
import CallOverlay from '@/components/messaging/CallOverlay';
import { uploadCallRecording } from '@/lib/api';

export type PageMessagingHandlers = Partial<{
  onNewMessage: (msg: WSMessage) => void;
  onTyping: (msg: WSMessage) => void;
  onChannelUpdate: (msg: WSMessage) => void;
  onMessageEdited: (msg: WSMessage) => void;
  onMessageDeleted: (msg: WSMessage) => void;
  onReactionAdded: (msg: WSMessage) => void;
  onReactionRemoved: (msg: WSMessage) => void;
  onThreadReply: (msg: WSMessage) => void;
  onPresence: (msg: WSMessage) => void;
  onMessagePinned: (msg: WSMessage) => void;
  onStatusUpdate: (msg: WSMessage) => void;
}>;

type MessagingConnectionContextValue = {
  connected: boolean;
  sendTyping: (channelId: string) => void;
  sendWsMessage: (data: Record<string, unknown>) => void;
  sendPresenceUpdate: (status: 'online' | 'away' | 'dnd') => void;
  /** Register handlers while the Messages page is mounted; cleared on unmount */
  registerPageHandlers: (handlers: PageMessagingHandlers) => () => void;
  webrtcCall: ReturnType<typeof useWebRTCCall>;
};

const MessagingConnectionContext = createContext<MessagingConnectionContextValue | null>(null);

export function MessagingConnectionProvider({ children }: { children: React.ReactNode }) {
  const { user, token, isAuthenticated } = useAuth();
  const pageHandlersRef = useRef<PageMessagingHandlers>({});
  const [transcriptionToast, setTranscriptionToast] = useState<{ channelId: string; text: string } | null>(null);

  const registerPageHandlers = useCallback((handlers: PageMessagingHandlers) => {
    pageHandlersRef.current = handlers;
    return () => {
      pageHandlersRef.current = {};
    };
  }, []);

  const sendWsFnRef = useRef<(data: Record<string, unknown>) => void>(() => {});
  const stableSendWs = useCallback((data: Record<string, unknown>) => {
    sendWsFnRef.current(data);
  }, []);

  const webrtcCall = useWebRTCCall({
    currentUserId: user?.id || '',
    currentUserName: user?.username || '',
    sendWsMessage: stableSendWs,
  });

  const webrtcRef = useRef(webrtcCall);
  webrtcRef.current = webrtcCall;

  const { connected, sendTyping, sendWsMessage, sendPresenceUpdate } = useMessagingWebSocket({
    token,
    enabled: isAuthenticated,
    onNewMessage: (m) => pageHandlersRef.current.onNewMessage?.(m),
    onTyping: (m) => pageHandlersRef.current.onTyping?.(m),
    onChannelUpdate: (m) => pageHandlersRef.current.onChannelUpdate?.(m),
    onMessageEdited: (m) => pageHandlersRef.current.onMessageEdited?.(m),
    onMessageDeleted: (m) => pageHandlersRef.current.onMessageDeleted?.(m),
    onReactionAdded: (m) => pageHandlersRef.current.onReactionAdded?.(m),
    onReactionRemoved: (m) => pageHandlersRef.current.onReactionRemoved?.(m),
    onThreadReply: (m) => pageHandlersRef.current.onThreadReply?.(m),
    onPresence: (m) => pageHandlersRef.current.onPresence?.(m),
    onMessagePinned: (m) => pageHandlersRef.current.onMessagePinned?.(m),
    onStatusUpdate: (m) => pageHandlersRef.current.onStatusUpdate?.(m),
    onCallIncoming: (m) => webrtcRef.current.handleCallIncoming(m),
    onCallAccepted: (m) => webrtcRef.current.handleCallAccepted(m),
    onCallRejected: (m) => webrtcRef.current.handleCallRejected(m),
    onCallEnded: (m) => webrtcRef.current.handleCallEnded(m),
    onWebRTCOffer: (m) => webrtcRef.current.handleWebRTCOffer(m),
    onWebRTCAnswer: (m) => webrtcRef.current.handleWebRTCAnswer(m),
    onWebRTCIceCandidate: (m) => webrtcRef.current.handleWebRTCIceCandidate(m),
    onGroupCallParticipantJoined: (m) => webrtcRef.current.handleGroupCallParticipantJoined(m),
    onGroupCallParticipantLeft: (m) => webrtcRef.current.handleGroupCallParticipantLeft(m),
  });

  sendWsFnRef.current = sendWsMessage;

  // Auto-upload call recording for transcription (uses channel from recording metadata)
  const transcriptionUploadedRef = useRef(false);
  useEffect(() => {
    if (webrtcCall.callState !== 'idle') {
      transcriptionUploadedRef.current = false;
    }
  }, [webrtcCall.callState]);

  useEffect(() => {
    const meta = webrtcCall.recordingUploadMeta;
    if (
      webrtcCall.callState !== 'idle' ||
      !webrtcCall.recordingBlob ||
      !meta?.channelId ||
      transcriptionUploadedRef.current
    ) {
      return;
    }
    transcriptionUploadedRef.current = true;
    uploadCallRecording(
      meta.channelId,
      webrtcCall.recordingBlob,
      meta.callType,
      meta.duration,
    )
      .then((res) => {
        if (res.status === 'completed' && res.transcription_text) {
          setTranscriptionToast({ channelId: meta.channelId!, text: res.transcription_text ?? '' });
        } else {
          setTranscriptionToast({ channelId: meta.channelId!, text: '' });
        }
      })
      .catch((err) => console.error('Failed to upload call recording:', err))
      .finally(() => {
        webrtcCall.clearRecording();
      });
  }, [webrtcCall.callState, webrtcCall.recordingBlob, webrtcCall.recordingUploadMeta]);

  const value: MessagingConnectionContextValue = {
    connected,
    sendTyping,
    sendWsMessage,
    sendPresenceUpdate,
    registerPageHandlers,
    webrtcCall,
  };

  return (
    <MessagingConnectionContext.Provider value={value}>
      {children}
      {isAuthenticated && (webrtcCall.callState !== 'idle' || webrtcCall.callError) && webrtcCall.callInfo && (
        <CallOverlay
          callState={webrtcCall.callState}
          callType={webrtcCall.callInfo?.callType ?? 'audio'}
          remoteUserName={webrtcCall.callInfo?.remoteUserName ?? ''}
          isCaller={webrtcCall.callInfo?.isCaller ?? false}
          isGroup={webrtcCall.callInfo?.isGroup ?? false}
          isMuted={webrtcCall.isMuted}
          isVideoOff={webrtcCall.isVideoOff}
          callDuration={webrtcCall.callDuration}
          participants={webrtcCall.participants}
          localVideoRef={webrtcCall.localVideoRef}
          remoteVideoRef={webrtcCall.remoteVideoRef}
          remoteAudioRef={webrtcCall.remoteAudioRef}
          callError={webrtcCall.callError}
          onClearError={webrtcCall.clearCallError}
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
      {/* Error toast when call fails before/after active state */}
      {isAuthenticated && !webrtcCall.callInfo && webrtcCall.callError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-red-600 text-white px-5 py-3 rounded-xl shadow-2xl max-w-sm text-sm">
          <span className="flex-1">{webrtcCall.callError}</span>
          <button onClick={webrtcCall.clearCallError} className="text-white/80 hover:text-white font-bold text-lg leading-none">×</button>
        </div>
      )}
      {/* Transcription ready toast */}
      {transcriptionToast && (
        <TranscriptionToast
          toast={transcriptionToast}
          onClose={() => setTranscriptionToast(null)}
        />
      )}
    </MessagingConnectionContext.Provider>
  );
}

export function useMessagingConnection() {
  const ctx = useContext(MessagingConnectionContext);
  if (!ctx) {
    throw new Error('useMessagingConnection must be used within MessagingConnectionProvider');
  }
  return ctx;
}

/** Auto-dismissing toast shown when a call transcription finishes processing */
function TranscriptionToast({
  toast,
  onClose,
}: {
  toast: { channelId: string; text: string };
  onClose: () => void;
}) {
  // Auto-dismiss after 12 seconds
  React.useEffect(() => {
    const t = setTimeout(onClose, 12_000);
    return () => clearTimeout(t);
  }, [onClose]);

  const hasText = toast.text.trim().length > 0;

  return (
    <div className="fixed bottom-6 right-6 z-[9998] w-80 bg-white dark:bg-[#1a1d21] border border-neutral-200 dark:border-[#383a3f] rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 dark:bg-green-900/20 border-b border-green-100 dark:border-green-900/30">
        <span className="text-green-600 dark:text-green-400 text-sm font-medium flex-1">
          🎙 Transcription ready
        </span>
        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 font-bold text-lg leading-none">×</button>
      </div>
      {/* Preview */}
      <div className="px-4 py-3">
        {hasText ? (
          <>
            <p className="text-xs text-neutral-600 dark:text-neutral-300 line-clamp-4 leading-relaxed">
              {toast.text}
            </p>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-2">
              Open <strong>Messages</strong>, select the channel, and click the <strong>transcriptions button</strong> (🎙) in the header to read the full transcript.
            </p>
          </>
        ) : (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Recording saved but no speech was detected. Open the transcriptions panel in the channel to view details.
          </p>
        )}
      </div>
    </div>
  );
}

/** Safe hook for optional use outside provider (returns null) */
export function useOptionalMessagingConnection() {
  return useContext(MessagingConnectionContext);
}
