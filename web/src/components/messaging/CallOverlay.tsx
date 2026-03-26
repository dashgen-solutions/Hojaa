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
  callError?: string | null;
  onClearError?: () => void;
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

/** Video element that sets srcObject via useEffect (correct React pattern) */
function StreamVideo({
  srcRef,
  muted = false,
  className = '',
  playsInline = true,
  onStreamReady,
}: {
  srcRef: React.RefObject<HTMLVideoElement | null>;
  muted?: boolean;
  className?: string;
  playsInline?: boolean;
  onStreamReady?: () => void;
}) {
  const localRef = useRef<HTMLVideoElement>(null);

  // Wire the local DOM ref to the shared hook ref, and play when stream arrives
  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    // Assign the shared ref so the hook can set srcObject later
    (srcRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;

    // If srcObject already set by hook, play now
    if (el.srcObject) {
      el.play().catch(() => {});
      onStreamReady?.();
    }

    // Watch for srcObject changes via a MutationObserver on readyState
    const tryPlay = () => {
      if (el.srcObject) {
        el.play().catch(() => {});
        onStreamReady?.();
      }
    };
    el.addEventListener('loadedmetadata', tryPlay);
    return () => {
      el.removeEventListener('loadedmetadata', tryPlay);
    };
  }, [srcRef, onStreamReady]);

  return (
    <video
      ref={localRef}
      autoPlay
      playsInline={playsInline}
      muted={muted}
      className={className}
    />
  );
}

/** Audio element that sets srcObject via useEffect */
function StreamAudio({ srcRef }: { srcRef: React.RefObject<HTMLAudioElement | null> }) {
  const localRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    (srcRef as React.MutableRefObject<HTMLAudioElement | null>).current = el;
    if (el.srcObject) el.play().catch(() => {});
    const tryPlay = () => { if (el.srcObject) el.play().catch(() => {}); };
    el.addEventListener('loadedmetadata', tryPlay);
    return () => el.removeEventListener('loadedmetadata', tryPlay);
  }, [srcRef]);
  return <audio ref={localRef} autoPlay playsInline className="hidden" />;
}

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
  callError,
  onClearError,
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
  const [pulse, setPulse] = useState(false);
  const [remoteStreamReady, setRemoteStreamReady] = useState(false);

  useEffect(() => {
    if (callState === 'ringing' || callState === 'calling') {
      const interval = setInterval(() => setPulse((p) => !p), 800);
      return () => clearInterval(interval);
    }
  }, [callState]);

  // Reset remote stream indicator when a new call starts
  useEffect(() => {
    if (callState !== 'connected') setRemoteStreamReady(false);
  }, [callState]);

  if (callState === 'idle' || callState === 'ended') {
    if (callError) {
      return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-red-600 text-white px-5 py-3 rounded-xl shadow-2xl max-w-sm text-sm">
          <span className="flex-1">{callError}</span>
          <button onClick={onClearError} className="text-white/80 hover:text-white font-bold text-lg leading-none">×</button>
        </div>
      );
    }
    return null;
  }

  // ---- Incoming call ----
  if (callState === 'ringing' && !isCaller) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center space-y-6">
          <div className={`mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-3xl font-bold transition-transform duration-300 ${pulse ? 'scale-110' : 'scale-100'}`}>
            {remoteUserName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{remoteUserName}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Incoming {isGroup ? 'group ' : ''}{callType} call…
            </p>
            {callType === 'video' && (
              <p className="text-xs text-gray-400 mt-1">
                Allow camera &amp; microphone when prompted.
              </p>
            )}
            {callError && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-lg">⚠ {callError}</p>
            )}
          </div>
          <div className="flex items-center justify-center gap-10">
            <div className="flex flex-col items-center gap-1">
              <button onClick={onReject} className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition-colors" title="Decline">
                <PhoneXMarkIcon className="w-7 h-7" />
              </button>
              <span className="text-xs text-gray-500">Decline</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <button onClick={onAccept} className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white shadow-lg transition-colors" title="Accept">
                <PhoneIcon className="w-7 h-7" />
              </button>
              <span className="text-xs text-gray-500">Accept</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Outgoing call ----
  if (callState === 'calling') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center space-y-6">
          <div className={`mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-3xl font-bold transition-transform duration-300 ${pulse ? 'scale-110' : 'scale-100'}`}>
            {remoteUserName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{remoteUserName}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Calling…</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Will cancel automatically if no answer in 30s
            </p>
          </div>
          <button onClick={onHangUp} className="w-14 h-14 mx-auto rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition-colors" title="Cancel">
            <PhoneXMarkIcon className="w-7 h-7" />
          </button>
        </div>
      </div>
    );
  }

  // ---- Connected ----
  const isVideo = callType === 'video';

  return (
    <div className="fixed inset-0 z-[9999] bg-gray-900 flex flex-col overflow-hidden">
      {/* Audio element — only for audio calls; video calls use remoteVideoRef which carries audio+video */}
      {!isVideo && <StreamAudio srcRef={remoteAudioRef} />}
      {/* Group participant audio */}
      {isGroup && participants.map((p) => (
        <ParticipantAudio key={p.userId} stream={p.stream} />
      ))}

      {/* ── Top bar ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-gray-800 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {isGroup ? '#' : remoteUserName.charAt(0).toUpperCase()}
          </div>
          <span className="text-white font-medium truncate max-w-[160px]">{remoteUserName}</span>
          {isGroup && participants.length > 0 && (
            <span className="text-gray-400 text-xs">{participants.length + 1} participants</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isRecording && (
            <span className="inline-flex items-center gap-1 text-xs text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              REC
            </span>
          )}
          <span className="text-gray-400 text-sm font-mono">{formatDuration(callDuration)}</span>
        </div>
      </div>

      {/* Error banner */}
      {callError && (
        <div className="flex-shrink-0 flex items-center gap-2 bg-amber-500 text-white text-xs px-4 py-2 z-10">
          <span className="flex-1">⚠ {callError}</span>
          {onClearError && <button onClick={onClearError} className="font-bold">×</button>}
        </div>
      )}

      {/* ── Video / Audio area ── fills remaining space */}
      <div className="flex-1 min-h-0 relative bg-gray-900">
        {isGroup ? (
          <div className="w-full h-full flex flex-wrap items-center justify-center gap-3 p-4 overflow-auto">
            {/* Local tile */}
            <div className="relative rounded-xl overflow-hidden bg-gray-800 shadow-lg flex-shrink-0"
                 style={{ width: tileSize(participants.length + 1), height: tileSize(participants.length + 1) }}>
              {isVideo ? (
                <StreamVideo srcRef={localVideoRef} muted className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold">You</div>
                </div>
              )}
              <span className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-0.5 rounded-md">
                You {isMuted ? '🔇' : ''}
              </span>
            </div>
            {/* Remote tiles */}
            {participants.map((p) => (
              <div key={p.userId} className="relative rounded-xl overflow-hidden bg-gray-800 shadow-lg flex-shrink-0"
                   style={{ width: tileSize(participants.length + 1), height: tileSize(participants.length + 1) }}>
                {isVideo && p.stream ? (
                  <ParticipantVideo stream={p.stream} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-xl font-bold">
                      {p.userName.charAt(0).toUpperCase()}
                    </div>
                  </div>
                )}
                <span className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-0.5 rounded-md">{p.userName}</span>
              </div>
            ))}
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
            {/* Remote video — fills area, shows placeholder while connecting */}
            {!remoteStreamReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-[1]">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-3xl font-bold mb-3">
                  {remoteUserName.charAt(0).toUpperCase()}
                </div>
                <p className="text-white font-medium">{remoteUserName}</p>
                <p className="text-gray-400 text-sm mt-1 animate-pulse">Connecting video…</p>
              </div>
            )}
            <StreamVideo
              srcRef={remoteVideoRef}
              className="absolute inset-0 w-full h-full object-cover"
              onStreamReady={() => setRemoteStreamReady(true)}
            />
            {/* Local video PIP */}
            <div className="absolute bottom-4 right-4 z-[2] rounded-xl overflow-hidden shadow-xl border-2 border-white/20 w-36 h-24 bg-gray-800">
              {!isVideoOff ? (
                <StreamVideo srcRef={localVideoRef} muted className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <VideoCameraSlashIcon className="w-8 h-8 text-gray-500" />
                </div>
              )}
              <span className="absolute bottom-1 left-1 text-[10px] text-white bg-black/50 px-1.5 py-0.5 rounded">
                You {isMuted ? '🔇' : ''}
              </span>
            </div>
          </>
        ) : (
          /* Audio-only */
          <div className="w-full h-full flex flex-col items-center justify-center gap-4">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-6xl font-bold shadow-2xl">
              {remoteUserName.charAt(0).toUpperCase()}
            </div>
            <p className="text-white text-xl font-semibold">{remoteUserName}</p>
            <p className="text-gray-400 text-sm">Audio call · {formatDuration(callDuration)}</p>
            {isMuted && <p className="text-red-400 text-xs">You are muted</p>}
          </div>
        )}
      </div>

      {/* ── Controls bar — always visible, fixed height ── */}
      <div className="flex-shrink-0 flex items-center justify-center gap-5 py-5 bg-gray-800 z-10">
        {/* Mute */}
        <ControlBtn
          active={isMuted}
          activeClass="bg-red-500"
          inactiveClass="bg-gray-600 hover:bg-gray-500"
          onClick={onToggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          <MicrophoneIcon className="w-5 h-5" />
          {isMuted && <div className="absolute w-7 h-0.5 bg-white rotate-45 rounded pointer-events-none" />}
        </ControlBtn>

        {/* Video toggle (video calls only) */}
        {isVideo && (
          <ControlBtn
            active={isVideoOff}
            activeClass="bg-red-500"
            inactiveClass="bg-gray-600 hover:bg-gray-500"
            onClick={onToggleVideo}
            title={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
          >
            {isVideoOff ? <VideoCameraSlashIcon className="w-5 h-5" /> : <VideoCameraIcon className="w-5 h-5" />}
          </ControlBtn>
        )}

        {/* Record */}
        {onToggleRecording && (
          <ControlBtn
            active={!!isRecording}
            activeClass="bg-red-500 animate-pulse"
            inactiveClass="bg-gray-600 hover:bg-gray-500"
            onClick={onToggleRecording}
            title={isRecording ? 'Stop recording' : 'Record call'}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              {isRecording ? <rect x="6" y="6" width="12" height="12" rx="2" /> : <circle cx="12" cy="12" r="7" />}
            </svg>
          </ControlBtn>
        )}

        {/* Hang up */}
        <button
          onClick={onHangUp}
          className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition-colors"
          title="End call"
        >
          <PhoneXMarkIcon className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}

/** Generic control button */
function ControlBtn({
  active, activeClass, inactiveClass, onClick, title, children,
}: {
  active: boolean;
  activeClass: string;
  inactiveClass: string;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative w-12 h-12 rounded-full flex items-center justify-center text-white transition-colors ${active ? activeClass : inactiveClass}`}
      title={title}
    >
      {children}
    </button>
  );
}

function tileSize(count: number): string {
  if (count <= 2) return '48%';
  if (count <= 4) return '46%';
  if (count <= 6) return '30%';
  return '24%';
}

function ParticipantVideo({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => {});
    }
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={false} className="w-full h-full object-cover" />;
}

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
