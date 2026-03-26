'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  XMarkIcon,
  MicrophoneIcon,
  VideoCameraIcon,
  ArrowDownTrayIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  PencilIcon,
  CheckIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { getChannelTranscriptions, updateRecordingTitle, CallTranscriptionItem } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

interface CallTranscriptionsPanelProps {
  channelId: string;
  channelName: string;
  onClose: () => void;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function defaultTitle(item: CallTranscriptionItem): string {
  const date = new Date(item.created_at).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
  return `${item.call_type === 'video' ? 'Video' : 'Audio'} Call · ${date}`;
}

function downloadTxt(text: string, filename: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Audio Player ──────────────────────────────────────────────────────────────

function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);

  const fullUrl = src.startsWith('http') ? src : `${API_BASE}${src}`;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = ratio * duration;
  };

  return (
    <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg px-3 py-2 mt-2">
      <audio
        ref={audioRef}
        src={fullUrl}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onTimeUpdate={() => { if (audioRef.current) setProgress(audioRef.current.currentTime); }}
        onLoadedMetadata={() => { if (audioRef.current) { setDuration(audioRef.current.duration); setReady(true); } }}
        onCanPlay={() => setReady(true)}
        preload="metadata"
      />
      <button
        onClick={togglePlay}
        disabled={!ready}
        className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full bg-blue-500 hover:bg-blue-600 disabled:bg-neutral-300 dark:disabled:bg-neutral-600 text-white transition"
      >
        {playing ? <PauseIcon className="w-3.5 h-3.5" /> : <PlayIcon className="w-3.5 h-3.5 ml-0.5" />}
      </button>
      <div
        className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full cursor-pointer relative overflow-hidden"
        onClick={handleSeek}
      >
        <div
          className="h-full bg-blue-500 rounded-full transition-all"
          style={{ width: duration ? `${(progress / duration) * 100}%` : '0%' }}
        />
      </div>
      <span className="text-[10px] text-neutral-500 dark:text-gray-500 flex-shrink-0 w-16 text-right tabular-nums">
        {ready
          ? `${Math.floor(progress / 60)}:${String(Math.floor(progress % 60)).padStart(2, '0')} / ${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}`
          : 'Loading…'}
      </span>
      <SpeakerWaveIcon className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
    </div>
  );
}

// ─── Inline title editor ───────────────────────────────────────────────────────

function TitleEditor({
  channelId,
  item,
  onSaved,
}: {
  channelId: string;
  item: CallTranscriptionItem;
  onSaved: (newTitle: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.title ?? '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayTitle = item.title?.trim() || defaultTitle(item);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setValue(item.title ?? '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const cancel = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditing(false);
    setValue(item.title ?? '');
  };

  const save = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSaving(true);
    try {
      await updateRecordingTitle(channelId, item.id, value.trim());
      onSaved(value.trim() || null);
      setEditing(false);
    } catch {
      // keep editing open on failure
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') cancel();
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={255}
          placeholder="Enter recording name…"
          className="flex-1 min-w-0 text-xs font-semibold bg-white dark:bg-neutral-800 border border-blue-400 dark:border-blue-500 rounded px-2 py-0.5 text-neutral-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-blue-400"
        />
        <button
          onClick={save}
          disabled={saving}
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-green-500 hover:text-green-600 disabled:opacity-40"
          title="Save"
        >
          <CheckIcon className="w-4 h-4" />
        </button>
        <button
          onClick={cancel}
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          title="Cancel"
        >
          <XCircleIcon className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0 group/title">
      <span className="text-xs font-semibold text-neutral-800 dark:text-gray-200 truncate">
        {displayTitle}
      </span>
      <button
        onClick={startEdit}
        className="flex-shrink-0 opacity-0 group-hover/title:opacity-100 transition-opacity w-4 h-4 flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
        title="Rename recording"
      >
        <PencilIcon className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── Transcription Card ────────────────────────────────────────────────────────

function TranscriptionCard({
  channelId,
  item: initialItem,
  expanded,
  onToggle,
}: {
  channelId: string;
  item: CallTranscriptionItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [item, setItem] = useState(initialItem);
  const hasText = !!item.transcription_text?.trim();
  const hasAudio = !!item.audio_url;
  const isVideo = item.call_type === 'video';

  const handleTitleSaved = (newTitle: string | null) => {
    setItem((prev) => ({ ...prev, title: newTitle }));
  };

  const handleDownloadTxt = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.transcription_text) return;
    const safeName = (item.title?.trim() || defaultTitle(item)).replace(/[^a-z0-9_\- ]/gi, '_');
    downloadTxt(item.transcription_text, `${safeName}.txt`);
  };

  const handleDownloadAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.audio_url) return;
    const fullUrl = item.audio_url.startsWith('http') ? item.audio_url : `${API_BASE}${item.audio_url}`;
    const safeName = (item.title?.trim() || defaultTitle(item)).replace(/[^a-z0-9_\- ]/gi, '_');
    const a = document.createElement('a');
    a.href = fullUrl;
    a.download = `${safeName}.webm`;
    a.click();
  };

  return (
    <div className="border border-neutral-200 dark:border-[#383a3f] rounded-xl mx-3 mb-3 overflow-hidden">
      {/* Collapsed header */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 hover:bg-neutral-50 dark:hover:bg-[#2a2d32] transition-colors"
      >
        <div className="flex items-center justify-between gap-2">
          {/* Icon */}
          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isVideo ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
            {isVideo
              ? <VideoCameraIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              : <MicrophoneIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
          </div>

          {/* Title + pencil (stop click propagation so card doesn't expand when editing) */}
          <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
            <TitleEditor channelId={channelId} item={item} onSaved={handleTitleSaved} />
            <p className="text-[11px] text-neutral-500 dark:text-gray-500">
              {formatDuration(item.duration_seconds)} · {formatDate(item.created_at)}
            </p>
          </div>

          {/* Status + chevron */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              item.status === 'completed'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : item.status === 'failed'
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
            }`}>
              {item.status}
            </span>
            {expanded
              ? <ChevronUpIcon className="w-3.5 h-3.5 text-neutral-400" />
              : <ChevronDownIcon className="w-3.5 h-3.5 text-neutral-400" />}
          </div>
        </div>

        {/* Participants */}
        {item.participants && item.participants.length > 0 && (
          <p className="text-[11px] text-neutral-500 dark:text-gray-500 mt-1.5 pl-9 truncate">
            {item.participants.map((p) => p.username).join(', ')}
          </p>
        )}
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-neutral-100 dark:border-[#2a2d32] px-4 pt-3 pb-4 bg-neutral-50 dark:bg-[#1e2125]">
          {hasAudio && <AudioPlayer src={item.audio_url!} />}

          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-neutral-500 dark:text-gray-500 uppercase tracking-wide">
                Transcript
              </span>
              {hasText && (
                <button
                  onClick={handleDownloadTxt}
                  className="flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  title="Download as .txt"
                >
                  <ArrowDownTrayIcon className="w-3 h-3" />
                  Download .txt
                </button>
              )}
            </div>

            {hasText ? (
              <div className="text-xs text-neutral-700 dark:text-gray-300 leading-relaxed bg-white dark:bg-neutral-800/60 rounded-lg px-3 py-2.5 whitespace-pre-wrap max-h-48 overflow-y-auto border border-neutral-200 dark:border-neutral-700">
                {item.transcription_text}
              </div>
            ) : (
              <p className="text-[11px] text-neutral-400 dark:text-gray-600 italic px-1">
                {item.status === 'failed'
                  ? 'Transcription failed — the recording may be too short or unclear.'
                  : 'No speech detected in this recording.'}
              </p>
            )}
          </div>

          {hasAudio && (
            <button
              onClick={handleDownloadAudio}
              className="mt-3 flex items-center gap-1.5 text-[11px] text-neutral-600 dark:text-gray-400 hover:text-neutral-900 dark:hover:text-gray-200 transition-colors bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 w-full justify-center hover:bg-neutral-50 dark:hover:bg-neutral-700"
            >
              <ArrowDownTrayIcon className="w-3.5 h-3.5" />
              Download recording
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Panel ─────────────────────────────────────────────────────────────────────

export default function CallTranscriptionsPanel({
  channelId,
  channelName,
  onClose,
}: CallTranscriptionsPanelProps) {
  const [items, setItems] = useState<CallTranscriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getChannelTranscriptions(channelId, 50)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [channelId]);

  return (
    <div className="flex flex-col h-full border-l border-neutral-200 dark:border-[#383a3f] bg-white dark:bg-[#1a1d21] w-80 flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-[#383a3f]">
        <div className="flex items-center gap-2">
          <MicrophoneIcon className="w-4 h-4 text-neutral-500 dark:text-gray-400" />
          <span className="text-sm font-semibold text-neutral-800 dark:text-gray-200">Call Recordings</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-[#2a2d32]"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Channel subtitle */}
      <div className="px-4 py-2 border-b border-neutral-200 dark:border-[#383a3f]">
        <p className="text-xs text-neutral-500 dark:text-gray-500">
          Recordings from{' '}
          <span className="font-medium text-neutral-700 dark:text-gray-300">{channelName}</span>
        </p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pt-3">
        {loading ? (
          <div className="flex flex-col gap-3 px-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse space-y-2 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 bg-neutral-200 dark:bg-neutral-700 rounded w-2/3" />
                    <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <div className="w-14 h-14 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
              <MicrophoneIcon className="w-7 h-7 text-neutral-400" />
            </div>
            <p className="text-sm text-neutral-600 dark:text-gray-400 font-medium">No recordings yet</p>
            <p className="text-xs text-neutral-400 dark:text-gray-600">
              Start a call, press the record button, and the recording + transcript will appear here after the call ends.
            </p>
          </div>
        ) : (
          <div>
            {items.map((item) => (
              <TranscriptionCard
                key={item.id}
                channelId={channelId}
                item={item}
                expanded={expanded === item.id}
                onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
