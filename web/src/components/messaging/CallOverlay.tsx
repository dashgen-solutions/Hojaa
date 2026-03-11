'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  PhoneIcon,
  PhoneXMarkIcon,
  MicrophoneIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
} from '@heroicons/react/24/solid';
import type { CallState, CallType, CallParticipant } from '@/hooks/useWebRTCCall';

interface CallOverlayProps {
  callState: CallState;
  callType: CallType;
  remoteUserName: string;
  isCaller: boolean;
  isGroup: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  callDuration: number;
  participants: CallParticipant[];
  isRecording?: boolean;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;
  onAccept: () => void;
  onReject: () => void;
  onHangUp: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleRecording?: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * CallOverlay renders:
 * - Incoming call modal (ringing state, for callee)
 * - Outgoing call modal (calling state, for caller)
 * - In-call UI (connected state) with video/audio, controls
 */
export default function CallOverlay({
  callState,
  callType,
  remoteUserName,
  isCaller,
  isGroup,
  isMuted,
  isVideoOff,
  callDuration,
  participants,
  isRecording,
  localVideoRef,
  remoteVideoRef,
  remoteAudioRef,
  onAccept,
  onReject,
  onHangUp,
  onToggleMute,
  onToggleVideo,
  onToggleRecording,
}: CallOverlayProps) {
  // Pulse animation for ringing
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (callState === 'ringing' || callState === 'calling') {
      const interval = setInterval(() => setPulse((p) => !p), 800);
      return () => clearInterval(interval);
    }
  }, [callState]);

  if (callState === 'idle' || callState === 'ended') return null;

  // ---- Incoming call (ringing for callee) ----
  if (callState === 'ringing' && !isCaller) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center space-y-6">
          {/* Avatar placeholder */}
          <div
            className={`mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-3xl font-bold transition-transform ${pulse ? 'scale-110' : 'scale-100'}`}
          >
            {remoteUserName.charAt(0).toUpperCase()}
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{remoteUserName}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Incoming {isGroup ? 'group ' : ''}{callType} call…
            </p>
          </div>

          <div className="flex items-center justify-center gap-8">
            {/* Reject */}
            <button
              onClick={onReject}
              className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition-colors"
              title="Decline"
            >
              <PhoneXMarkIcon className="w-7 h-7" />
            </button>

            {/* Accept */}
            <button
              onClick={onAccept}
              className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white shadow-lg transition-colors animate-pulse"
              title="Accept"
            >
              <PhoneIcon className="w-7 h-7" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Outgoing call (calling for caller) ----
  if (callState === 'calling') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center space-y-6">
          <div
            className={`mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-3xl font-bold transition-transform ${pulse ? 'scale-110' : 'scale-100'}`}
          >
            {remoteUserName.charAt(0).toUpperCase()}
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{remoteUserName}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Calling…</p>
          </div>

          <button
            onClick={onHangUp}
            className="w-14 h-14 mx-auto rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition-colors"
            title="Cancel"
          >
            <PhoneXMarkIcon className="w-7 h-7" />
          </button>
        </div>
      </div>
    );
  }

  // ---- In-call (connected) ----
  const isVideo = callType === 'video';

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-gray-900">
      {/* Hidden audio elements for remote audio */}
      <audio ref={remoteAudioRef as React.LegacyRef<HTMLAudioElement>} autoPlay className="hidden" />
      {/* Hidden audio elements for group participants */}
      {isGroup && participants.map((p) => (
        <ParticipantAudio key={p.userId} stream={p.stream} />
      ))}

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-sm font-bold">
            {isGroup ? '#' : remoteUserName.charAt(0).toUpperCase()}
          </div>
          <div>
            <span className="text-white font-medium">{remoteUserName}</span>
            {isGroup && participants.length > 0 && (
              <span className="text-gray-400 text-xs ml-2">
                {participants.length + 1} participant{participants.length > 0 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <span className="text-gray-400 text-sm font-mono">
          {isRecording && <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse mr-2" title="Recording" />}
          {formatDuration(callDuration)}
        </span>
      </div>

      {/* Video / audio area */}
      <div className="flex-1 relative flex items-center justify-center">
        {isGroup ? (
          /* Group call layout */
          <div className="w-full h-full flex flex-wrap items-center justify-center gap-3 p-4">
            {/* Local video/avatar tile */}
            <div className="relative flex-shrink-0 rounded-xl overflow-hidden bg-gray-800 shadow-lg"
                 style={{ width: tileSize(participants.length + 1), height: tileSize(participants.length + 1) }}>
              {isVideo ? (
                <video
                  ref={localVideoRef as React.LegacyRef<HTMLVideoElement>}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
                    You
                  </div>
                </div>
              )}
              <span className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-0.5 rounded">
                You {isMuted ? '🔇' : ''}
              </span>
            </div>

            {/* Remote participant tiles */}
            {participants.map((p) => (
              <div key={p.userId}
                   className="relative flex-shrink-0 rounded-xl overflow-hidden bg-gray-800 shadow-lg"
                   style={{ width: tileSize(participants.length + 1), height: tileSize(participants.length + 1) }}>
                {isVideo && p.stream ? (
                  <ParticipantVideo stream={p.stream} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-2xl font-bold">
                      {p.userName.charAt(0).toUpperCase()}
                    </div>
                  </div>
                )}
                <span className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-0.5 rounded">
                  {p.userName}
                </span>
              </div>
            ))}

            {/* Waiting indicator if no participants connected yet */}
            {participants.length === 0 && (
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center animate-pulse">
                  <PhoneIcon className="w-8 h-8 text-gray-500" />
                </div>
                <p className="text-sm">Waiting for others to join…</p>
              </div>
            )}
          </div>
        ) : isVideo ? (
          <>
            {/* 1:1 Remote video (full area) */}
            <video
              ref={remoteVideoRef as React.LegacyRef<HTMLVideoElement>}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {/* Local video (PIP) */}
            <video
              ref={localVideoRef as React.LegacyRef<HTMLVideoElement>}
              autoPlay
              playsInline
              muted
              className="absolute bottom-4 right-4 w-40 h-28 rounded-lg border-2 border-white/30 object-cover shadow-lg"
            />
          </>
        ) : (
          /* 1:1 Audio-only: show large avatar */
          <div className="flex flex-col items-center gap-4">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-6xl font-bold shadow-xl">
              {remoteUserName.charAt(0).toUpperCase()}
            </div>
            <p className="text-white text-lg font-medium">{remoteUserName}</p>
            <p className="text-gray-400 text-sm">Audio call in progress</p>
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-center gap-6 py-6 bg-gray-800">
        {/* Mute */}
        <button
          onClick={onToggleMute}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
            isMuted ? 'bg-red-500 text-white' : 'bg-gray-600 text-white hover:bg-gray-500'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          <MicrophoneIcon className="w-6 h-6" />
          {isMuted && (
            <div className="absolute w-8 h-0.5 bg-white rotate-45 rounded" />
          )}
        </button>

        {/* Video toggle (only for video calls) */}
        {isVideo && (
          <button
            onClick={onToggleVideo}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isVideoOff ? 'bg-red-500 text-white' : 'bg-gray-600 text-white hover:bg-gray-500'
            }`}
            title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
          >
            {isVideoOff ? (
              <VideoCameraSlashIcon className="w-6 h-6" />
            ) : (
              <VideoCameraIcon className="w-6 h-6" />
            )}
          </button>
        )}

        {/* Record / Transcribe toggle */}
        {onToggleRecording && (
          <button
            onClick={onToggleRecording}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-600 text-white hover:bg-gray-500'
            }`}
            title={isRecording ? 'Stop recording' : 'Start recording for transcription'}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              {isRecording ? (
                <rect x="6" y="6" width="12" height="12" rx="2" />
              ) : (
                <circle cx="12" cy="12" r="7" />
              )}
            </svg>
          </button>
        )}

        {/* Hang up */}
        <button
          onClick={onHangUp}
          className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition-colors"
          title="End call"
        >
          <PhoneXMarkIcon className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
}

/** Compute tile size based on participant count */
function tileSize(count: number): string {
  if (count <= 2) return '48%';
  if (count <= 4) return '46%';
  if (count <= 6) return '30%';
  return '24%';
}

/** Renders video for a group call participant */
function ParticipantVideo({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => {});
    }
  }, [stream]);
  return <video ref={ref} autoPlay playsInline className="w-full h-full object-cover" />;
}

/** Hidden audio element that auto-plays a participant's audio stream */
function ParticipantAudio({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => {});
    }
  }, [stream]);
  return <audio ref={ref} autoPlay className="hidden" />;
}