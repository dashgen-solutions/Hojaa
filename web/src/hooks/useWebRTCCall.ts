'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export type CallState = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';
export type CallType = 'audio' | 'video';

export interface CallInfo {
  remoteUserId: string;      // For 1:1 — the other user. For group — the initiator (or first callee).
  remoteUserName: string;
  channelId: string;
  callType: CallType;
  isCaller: boolean;
  isGroup: boolean;
}

/** Participant in a group call */
export interface CallParticipant {
  userId: string;
  userName: string;
  stream: MediaStream | null;
}

interface UseWebRTCCallOptions {
  currentUserId: string;
  currentUserName?: string;
  sendWsMessage: (data: Record<string, unknown>) => void;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

/**
 * React hook for WebRTC audio/video calling.
 *
 * Supports BOTH 1:1 calls and group calls (mesh topology).
 * Uses the messaging WebSocket for signaling (offer/answer/ICE).
 *
 * IMPORTANT: All WS-facing handlers use refs for callInfo / callState
 * so their identities never change — this prevents the WS hook from
 * reconnecting whenever call state changes.
 */
export function useWebRTCCall({ currentUserId, currentUserName, sendWsMessage }: UseWebRTCCallOptions) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const callDurationRef = useRef(0);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);

  // ── Refs that mirror state so callbacks never go stale ──────────
  const callStateRef = useRef<CallState>(callState);
  const callInfoRef = useRef<CallInfo | null>(callInfo);
  useEffect(() => { callStateRef.current = callState; }, [callState]);
  useEffect(() => { callInfoRef.current = callInfo; }, [callInfo]);
  useEffect(() => { callDurationRef.current = callDuration; }, [callDuration]);

  // ── Multiple peer connections for group calls (keyed by userId) ──
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  // Track which group call participants we know about
  const groupParticipantIdsRef = useRef<Set<string>>(new Set());

  // ── Call recording (MediaRecorder for transcription) ──
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  /** Populated when MediaRecorder finishes — used for transcription upload from any page */
  const [recordingUploadMeta, setRecordingUploadMeta] = useState<{
    channelId: string | null;
    duration: number;
    callType: CallType;
  } | null>(null);
  const recordingChannelIdRef = useRef<string | null>(null);
  const recordingCallTypeRef = useRef<CallType>('audio');
  const [isRecording, setIsRecording] = useState(false);

  // ── Call error (replaces browser alert()) ───────────────────────
  const [callError, setCallError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Call duration timer
  useEffect(() => {
    if (callState === 'connected') {
      setCallDuration(0);
      timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // 30-second timeout: if still 'calling' after 30s, the callee is likely offline/unavailable
  useEffect(() => {
    if (callState === 'calling') {
      callTimeoutRef.current = setTimeout(() => {
        if (callStateRef.current === 'calling') {
          setCallError('User is unavailable or offline. They may not be connected right now.');
          cleanupCall();
          setCallState('idle');
          setCallInfo(null);
        }
      }, 30_000);
    } else {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
    }
    return () => {
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState]);

  // Broadcast in_call presence when call becomes active; revert to online when idle
  useEffect(() => {
    if (callState === 'calling' || callState === 'connected') {
      sendWsMessage({ type: 'presence_update', status: 'in_call' });
    } else if (callState === 'idle') {
      sendWsMessage({ type: 'presence_update', status: 'online' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState]);

  // When callState becomes 'connected', the CallOverlay mounts the video/audio elements.
  // Re-attach all streams so srcObject is set AFTER the elements exist in the DOM.
  useEffect(() => {
    if (callState !== 'connected') return;
    const info = callInfoRef.current;

    // Local video
    if (localStreamRef.current && localVideoRef.current) {
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      localVideoRef.current.play().catch(() => {});
    }

    // Remote stream for 1:1 calls
    if (info && !info.isGroup) {
      const rs = remoteStreamsRef.current.get(info.remoteUserId);
      if (rs) {
        if (info.callType === 'video' && remoteVideoRef.current) {
          if (remoteVideoRef.current.srcObject !== rs) {
            remoteVideoRef.current.srcObject = rs;
          }
          remoteVideoRef.current.play().catch(() => {});
        }
        if (info.callType === 'audio' && remoteAudioRef.current) {
          if (remoteAudioRef.current.srcObject !== rs) {
            remoteAudioRef.current.srcObject = rs;
          }
          remoteAudioRef.current.play().catch(() => {});
        }
      }
    }
  }, [callState]);

  /** Clean up ALL peer connections and media streams */
  const cleanupCall = useCallback(() => {
    // Stop recording if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);

    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    remoteStreamsRef.current.clear();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    pendingCandidatesRef.current.clear();
    groupParticipantIdsRef.current.clear();
    setParticipants([]);
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
  }, []);

  /** Bind a remote stream to audio/video elements (for 1:1 calls) */
  const attachRemoteStream = useCallback((userId: string) => {
    const rs = remoteStreamsRef.current.get(userId);
    if (!rs) return;
    const info = callInfoRef.current;
    if (!info?.isGroup) {
      if (info?.callType === 'video' && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = rs;
        remoteVideoRef.current.play().catch(() => {});
      }
      if (info?.callType === 'audio' && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = rs;
        remoteAudioRef.current.play().catch(() => {});
      }
    }
    // For group calls, update participants state with the stream.
    // Also add them if they aren't in the list yet (e.g. callee receiving offer from caller).
    setParticipants((prev) => {
      const idx = prev.findIndex((p) => p.userId === userId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], stream: rs };
        return updated;
      }
      if (info?.isGroup) {
        return [...prev, { userId, userName: userId, stream: rs }];
      }
      return prev;
    });
  }, []);

  /** Create a peer connection for a specific remote user */
  const createPeerConnection = useCallback(
    (targetUserId: string) => {
      const existing = pcsRef.current.get(targetUserId);
      if (existing) existing.close();

      const pc = new RTCPeerConnection(ICE_SERVERS);

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendWsMessage({
            type: 'webrtc_ice_candidate',
            target_user_id: targetUserId,
            candidate: e.candidate.toJSON(),
          });
        }
      };

      // Best-practice: use event.streams[0] directly — it is guaranteed to contain
      // ALL tracks for this peer (audio + video together) once the SDP is negotiated.
      pc.ontrack = (e) => {
        const stream = e.streams[0];
        if (stream) {
          remoteStreamsRef.current.set(targetUserId, stream);
          attachRemoteStream(targetUserId);
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setCallState('connected');
          attachRemoteStream(targetUserId);
        }
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          const info = callInfoRef.current;
          if (info && !info.isGroup) {
            sendWsMessage({
              type: 'call_hangup',
              target_user_id: info.remoteUserId,
              reason: 'ice_failed',
            });
            cleanupCall();
            setCallState('idle');
            setCallInfo(null);
          } else {
            pc.close();
            pcsRef.current.delete(targetUserId);
            remoteStreamsRef.current.delete(targetUserId);
            setParticipants((prev) => prev.filter((p) => p.userId !== targetUserId));
          }
        }
      };

      pcsRef.current.set(targetUserId, pc);
      return pc;
    },
    [sendWsMessage, attachRemoteStream, cleanupCall],
  );

  /** Get user media (mic + optional camera) with resilient fallback */
  const getLocalMedia = useCallback(async (callType: CallType) => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }
    // Attempt 1: ideal constraints
    const videoConstraints: MediaTrackConstraints = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
    };

    const attempts: MediaStreamConstraints[] = callType === 'video'
      ? [
          { audio: true, video: videoConstraints },  // ideal constraints
          { audio: true, video: true },               // basic video
          { audio: true, video: false },              // audio-only fallback
        ]
      : [
          { audio: true, video: false },
        ];

    let lastErr: unknown;
    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStreamRef.current = stream;
        const hasVideo = stream.getVideoTracks().length > 0;
        if (callType === 'video' && !hasVideo) {
          // Warn but don't fail — audio-only will be used
          console.warn('Camera unavailable; proceeding with audio only.');
          setCallError('Camera unavailable. Joining with audio only.');
        }
        if (localVideoRef.current && hasVideo) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }
        return stream;
      } catch (err) {
        lastErr = err;
        console.warn('getUserMedia attempt failed:', constraints, err);
      }
    }
    // All attempts failed
    throw new Error(`Cannot access microphone: ${lastErr instanceof Error ? lastErr.message : lastErr}`);
  }, []);

  // ────────────── 1:1 Call Methods ──────────────

  /** Initiate a 1:1 call to another user */
  const startCall = useCallback(
    async (targetUserId: string, targetUserName: string, channelId: string, callType: CallType = 'audio') => {
      if (callStateRef.current !== 'idle') return;
      try {
        const info: CallInfo = {
          remoteUserId: targetUserId,
          remoteUserName: targetUserName,
          channelId,
          callType,
          isCaller: true,
          isGroup: false,
        };
        setCallInfo(info);
        callInfoRef.current = info;
        setCallState('calling');
        callStateRef.current = 'calling';

        // Pre-initialize media to ensure camera/mic access works
        try {
          await getLocalMedia(callType);
        } catch (err) {
          console.error('Failed to get local media:', err);
          setCallError(`Cannot access ${callType === 'video' ? 'camera/microphone' : 'microphone'}. Check browser permissions and try again.`);
          cleanupCall();
          setCallState('idle');
          setCallInfo(null);
          return;
        }

        sendWsMessage({
          type: 'call_initiate',
          target_user_id: targetUserId,
          channel_id: channelId,
          call_type: callType,
          is_group: false,
        });
      } catch (err) {
        console.error('Failed to start call:', err);
        cleanupCall();
        setCallState('idle');
        setCallInfo(null);
      }
    },
    [sendWsMessage, cleanupCall, getLocalMedia],
  );

  /** Accept an incoming call */
  const acceptCall = useCallback(
    async (callerUserId: string) => {
      const info = callInfoRef.current;
      if (!info || callStateRef.current !== 'ringing') return;
      try {
        // Pre-initialize media before accepting
        try {
          await getLocalMedia(info.callType);
        } catch (err) {
          console.error('Failed to get local media:', err);
          setCallError(`Cannot access ${info.callType === 'video' ? 'camera/microphone' : 'microphone'}. Check browser permissions.`);
          // Reject the call if we can't get media at all
          sendWsMessage({
            type: 'call_reject',
            caller_id: info.remoteUserId,
            channel_id: info.channelId,
            reason: 'media_error',
          });
          cleanupCall();
          setCallState('idle');
          setCallInfo(null);
          return;
        }

        sendWsMessage({
          type: 'call_accept',
          caller_id: callerUserId,
          channel_id: info.channelId,
        });
        setCallState('connected');
        callStateRef.current = 'connected';
      } catch (err) {
        console.error('Failed to accept call:', err);
        cleanupCall();
        setCallState('idle');
        setCallInfo(null);
      }
    },
    [sendWsMessage, cleanupCall, getLocalMedia],
  );

  /** Reject an incoming call */
  const rejectCall = useCallback(() => {
    const info = callInfoRef.current;
    if (!info) return;
    sendWsMessage({
      type: 'call_reject',
      caller_id: info.remoteUserId,
      channel_id: info.channelId,
      reason: 'rejected',
    });
    cleanupCall();
    setCallState('idle');
    setCallInfo(null);
  }, [sendWsMessage, cleanupCall]);

  /** End an ongoing call (1:1 or group) */
  const endCall = useCallback(() => {
    const info = callInfoRef.current;
    const dur = callDuration;
    if (info) {
      if (info.isGroup) {
        // Notify all group participants
        const participantIds = Array.from(groupParticipantIdsRef.current);
        sendWsMessage({
          type: 'group_call_leave',
          channel_id: info.channelId,
          participant_ids: participantIds,
        });
      } else {
        sendWsMessage({
          type: 'call_hangup',
          target_user_id: info.remoteUserId,
          channel_id: info.channelId,
          duration: dur,
          reason: 'hangup',
        });
      }
    }
    cleanupCall();
    setCallState('idle');
    setCallInfo(null);
  }, [sendWsMessage, cleanupCall, callDuration]);

  // ────────────── Group Call Methods ──────────────

  /** Start a group call — ring all members except self */
  const startGroupCall = useCallback(
    async (memberIds: string[], channelId: string, channelName: string, callType: CallType = 'audio') => {
      if (callStateRef.current !== 'idle') return;
      try {
        const targets = memberIds.filter((id) => id !== currentUserId);
        if (targets.length === 0) return;

        const info: CallInfo = {
          remoteUserId: targets[0],  // first recipient (for display fallback)
          remoteUserName: channelName,
          channelId,
          callType,
          isCaller: true,
          isGroup: true,
        };
        setCallInfo(info);
        callInfoRef.current = info;
        setCallState('calling');
        callStateRef.current = 'calling';

        // Track known participants
        targets.forEach((id) => groupParticipantIdsRef.current.add(id));

        sendWsMessage({
          type: 'call_initiate',
          target_user_ids: targets,
          channel_id: channelId,
          call_type: callType,
          is_group: true,
        });
      } catch (err) {
        console.error('Failed to start group call:', err);
        cleanupCall();
        setCallState('idle');
        setCallInfo(null);
      }
    },
    [currentUserId, sendWsMessage, cleanupCall],
  );

  /** Accept an incoming group call */
  const acceptGroupCall = useCallback(
    async (callerUserId: string) => {
      const info = callInfoRef.current;
      if (!info || callStateRef.current !== 'ringing') return;
      try {
        // Signal acceptance to the caller
        sendWsMessage({
          type: 'call_accept',
          caller_id: callerUserId,
          channel_id: info.channelId,
        });

        groupParticipantIdsRef.current.add(callerUserId);

        // Add the caller to participants immediately so the callee's UI shows them
        setParticipants((prev) => {
          if (prev.some((p) => p.userId === callerUserId)) return prev;
          return [...prev, { userId: callerUserId, userName: info.remoteUserName, stream: null }];
        });

        setCallState('connected');
        callStateRef.current = 'connected';

        // Announce ourselves to all known participants
        sendWsMessage({
          type: 'group_call_join',
          channel_id: info.channelId,
          participant_ids: [callerUserId],
        });
      } catch (err) {
        console.error('Failed to accept group call:', err);
        cleanupCall();
        setCallState('idle');
        setCallInfo(null);
      }
    },
    [sendWsMessage, cleanupCall],
  );

  /** Toggle mute */
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((t) => (t.enabled = !t.enabled));
      setIsMuted((m) => !m);
    }
  }, []);

  /** Toggle video on/off */
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length === 0) {
        console.warn('No video tracks available to toggle');
        return;
      }
      videoTracks.forEach((t) => {
        t.enabled = !t.enabled;
        console.log(`Video track ${t.id} enabled: ${t.enabled}`);
      });
      setIsVideoOff((v) => !v);
    }
  }, []);

  // ────────────── WS Message Handlers ──────────────
  // These use refs so their identity NEVER changes.

  /** Handle incoming call ring (1:1 or group) */
  const handleCallIncoming = useCallback(
    (msg: Record<string, unknown>) => {
      const callerId = msg.caller_id as string;
      const callerName = msg.caller_name as string;
      const channelId = msg.channel_id as string;
      const callType = (msg.call_type as string) || 'audio';
      const isGroup = Boolean(msg.is_group);

      if (callStateRef.current !== 'idle') {
        sendWsMessage({
          type: 'call_reject',
          caller_id: callerId,
          reason: 'busy',
        });
        return;
      }

      const info: CallInfo = {
        remoteUserId: callerId,
        remoteUserName: callerName,
        channelId,
        callType: callType as CallType,
        isCaller: false,
        isGroup,
      };
      setCallInfo(info);
      callInfoRef.current = info;
      setCallState('ringing');
      callStateRef.current = 'ringing';
    },
    [sendWsMessage],
  );

  /** Handle call accepted — caller creates PC + sends offer now */
  const handleCallAccepted = useCallback(
    async (msg?: Record<string, unknown>) => {
      const info = callInfoRef.current;
      if (!info) return;

      const calleeId = msg?.callee_id as string | undefined;
      const calleeName = msg?.callee_name as string | undefined;

      if (info.isGroup && calleeId) {
        // Group call: a participant accepted — set up PC with them
        groupParticipantIdsRef.current.add(calleeId);
        setParticipants((prev) => {
          if (prev.some((p) => p.userId === calleeId)) {
            return prev.map((p) =>
              p.userId === calleeId ? { ...p, userName: calleeName || calleeId } : p,
            );
          }
          return [...prev, { userId: calleeId, userName: calleeName || calleeId, stream: null }];
        });

        try {
          setCallState('connected');
          callStateRef.current = 'connected';

          const stream = await getLocalMedia(info.callType);
          const pc = createPeerConnection(calleeId);
          stream.getTracks().forEach((track) => pc.addTrack(track, stream));

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          sendWsMessage({
            type: 'webrtc_offer',
            target_user_id: calleeId,
            sdp: offer,
          });
        } catch (err) {
          console.error('Failed to create offer for group participant:', err);
        }
        return;
      }

      // 1:1 call
      if (!info.isCaller) {
        setCallState('connected');
        callStateRef.current = 'connected';
        return;
      }

      try {
        setCallState('connected');
        callStateRef.current = 'connected';

        const stream = await getLocalMedia(info.callType);
        const pc = createPeerConnection(info.remoteUserId);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendWsMessage({
          type: 'webrtc_offer',
          target_user_id: info.remoteUserId,
          sdp: offer,
        });
      } catch (err) {
        console.error('Failed to create offer after call accepted:', err);
        setCallError('Failed to establish connection. Please try again.');
        cleanupCall();
        setCallState('idle');
        setCallInfo(null);
      }
    },
    [getLocalMedia, createPeerConnection, sendWsMessage, cleanupCall],
  );

  /** Handle call rejected by callee */
  const handleCallRejected = useCallback(
    (_msg?: Record<string, unknown>) => {
      const info = callInfoRef.current;
      if (info?.isGroup) {
        // Group: one person rejected — don't end the whole call
        return;
      }
      cleanupCall();
      setCallState('idle');
      setCallInfo(null);
    },
    [cleanupCall],
  );

  /** Handle call ended by the other party */
  const handleCallEnded = useCallback((_msg?: Record<string, unknown>) => {
    const info = callInfoRef.current;
    if (info?.isGroup) {
      // Group: one person left — remove their PC
      const userId = _msg?.user_id as string | undefined;
      if (userId) {
        const pc = pcsRef.current.get(userId);
        if (pc) pc.close();
        pcsRef.current.delete(userId);
        remoteStreamsRef.current.delete(userId);
        groupParticipantIdsRef.current.delete(userId);
        setParticipants((prev) => prev.filter((p) => p.userId !== userId));
      }
      return;
    }
    cleanupCall();
    setCallState('idle');
    setCallInfo(null);
  }, [cleanupCall]);

  /** Handle incoming WebRTC offer (1:1 or group mesh) */
  const handleWebRTCOffer = useCallback(
    async (msg: Record<string, unknown>) => {
      const fromUserId = msg.from_user_id as string;
      const sdp = msg.sdp as RTCSessionDescriptionInit;
      const info = callInfoRef.current;
      if (!info) {
        console.error('Received offer but no call info');
        return;
      }

      // For group calls: ensure the offer sender is in the participants list
      if (info.isGroup) {
        setParticipants((prev) => {
          if (prev.some((p) => p.userId === fromUserId)) return prev;
          return [...prev, { userId: fromUserId, userName: fromUserId, stream: null }];
        });
      }

      // Always create a fresh PC for this offer to avoid stale state
      const pc = createPeerConnection(fromUserId);

      // Ensure local media is ready before adding tracks
      let stream = localStreamRef.current;
      if (!stream) {
        try {
          stream = await getLocalMedia(info.callType);
        } catch (err) {
          console.error('Callee: failed to get local media for offer:', err);
          setCallError('Cannot access microphone. Check browser permissions.');
          return;
        }
      }

      // Add ALL local tracks to this peer connection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream!);
      });

      // Set remote description (offer), create and send answer
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendWsMessage({
        type: 'webrtc_answer',
        target_user_id: fromUserId,
        sdp: answer,
      });

      // Apply any ICE candidates that arrived before the offer
      const pending = pendingCandidatesRef.current.get(fromUserId) || [];
      for (const candidate of pending) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current.delete(fromUserId);
    },
    [createPeerConnection, getLocalMedia, sendWsMessage],
  );

  /** Handle incoming WebRTC answer */
  const handleWebRTCAnswer = useCallback(
    async (msg: Record<string, unknown>) => {
      const fromUserId = msg.from_user_id as string;
      const sdp = msg.sdp as RTCSessionDescriptionInit;
      const pc = pcsRef.current.get(fromUserId);
      if (!pc) {
        console.error(`Caller: received answer from ${fromUserId} but no peer connection exists`);
        return;
      }
      console.log(`Caller: received answer from ${fromUserId}, setting remote description`);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      console.log('Caller: remote description set successfully');
    },
    [],
  );

  /** Handle incoming ICE candidate */
  const handleWebRTCIceCandidate = useCallback(
    async (msg: Record<string, unknown>) => {
      const fromUserId = msg.from_user_id as string;
      const candidate = msg.candidate as RTCIceCandidateInit;
      const pc = pcsRef.current.get(fromUserId);
      if (!pc || !pc.remoteDescription) {
        const pending = pendingCandidatesRef.current.get(fromUserId) || [];
        pending.push(candidate);
        pendingCandidatesRef.current.set(fromUserId, pending);
        return;
      }
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    },
    [],
  );

  /** Handle a new participant joining a group call (mesh: set up PC) */
  const handleGroupCallParticipantJoined = useCallback(
    async (msg: Record<string, unknown>) => {
      const userId = msg.user_id as string;
      const userName = msg.username as string;
      const info = callInfoRef.current;
      if (!info || callStateRef.current !== 'connected') return;

      groupParticipantIdsRef.current.add(userId);
      setParticipants((prev) => {
        if (prev.some((p) => p.userId === userId)) {
          // Update userName if we only had userId as placeholder
          return prev.map((p) => (p.userId === userId ? { ...p, userName } : p));
        }
        return [...prev, { userId, userName, stream: null }];
      });

      // Create PC and send offer to the new participant
      try {
        const stream = await getLocalMedia(info.callType);
        const pc = createPeerConnection(userId);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        sendWsMessage({
          type: 'webrtc_offer',
          target_user_id: userId,
          sdp: offer,
        });
      } catch (err) {
        console.error('Failed to create offer for new group participant:', err);
      }
    },
    [getLocalMedia, createPeerConnection, sendWsMessage],
  );

  /** Handle a participant leaving a group call */
  const handleGroupCallParticipantLeft = useCallback(
    (msg: Record<string, unknown>) => {
      const userId = msg.user_id as string;
      const pc = pcsRef.current.get(userId);
      if (pc) pc.close();
      pcsRef.current.delete(userId);
      remoteStreamsRef.current.delete(userId);
      groupParticipantIdsRef.current.delete(userId);
      setParticipants((prev) => prev.filter((p) => p.userId !== userId));

      // If no participants left in group call, end it
      if (pcsRef.current.size === 0 && callInfoRef.current?.isGroup) {
        cleanupCall();
        setCallState('idle');
        setCallInfo(null);
      }
    },
    [cleanupCall],
  );

  // ────────────── Call Recording (for transcription) ──────────────

  /** Start recording all call audio into a single blob */
  const startRecording = useCallback(() => {
    try {
      recordingChannelIdRef.current = callInfoRef.current?.channelId ?? null;
      recordingCallTypeRef.current = callInfoRef.current?.callType ?? 'audio';
      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();

      // Mix local audio
      if (localStreamRef.current) {
        const localAudio = localStreamRef.current.getAudioTracks();
        if (localAudio.length > 0) {
          const localSource = audioCtx.createMediaStreamSource(new MediaStream(localAudio));
          localSource.connect(dest);
        }
      }

      // Mix all remote audio
      remoteStreamsRef.current.forEach((stream) => {
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
          const source = audioCtx.createMediaStreamSource(new MediaStream(audioTracks));
          source.connect(dest);
        }
      });

      recordedChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(dest.stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        setRecordingUploadMeta({
          channelId: recordingChannelIdRef.current,
          duration: callDurationRef.current,
          callType: recordingCallTypeRef.current,
        });
        setRecordingBlob(blob);
        recordedChunksRef.current = [];
      };

      recorder.start(1000); // collect data every second
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }, []);

  /** Stop the current recording */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  /** Clear the recorded blob */
  const clearRecording = useCallback(() => {
    setRecordingBlob(null);
    setRecordingUploadMeta(null);
    recordedChunksRef.current = [];
  }, []);

  const clearCallError = useCallback(() => setCallError(null), []);

  return {
    callState,
    callInfo,
    callError,
    clearCallError,
    isMuted,
    isVideoOff,
    callDuration,
    participants,
    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,
    // Recording
    isRecording,
    recordingBlob,
    recordingUploadMeta,
    startRecording,
    stopRecording,
    clearRecording,
    // 1:1 call methods
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    // Group call methods
    startGroupCall,
    acceptGroupCall,
    // Shared controls
    toggleMute,
    toggleVideo,
    // WS handlers to wire up
    handleCallIncoming,
    handleCallAccepted,
    handleCallRejected,
    handleCallEnded,
    handleWebRTCOffer,
    handleWebRTCAnswer,
    handleWebRTCIceCandidate,
    handleGroupCallParticipantJoined,
    handleGroupCallParticipantLeft,
  };
}
