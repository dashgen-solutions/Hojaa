'use client';

import React, { useState, useRef, useEffect } from 'react';
import { XMarkIcon, FaceSmileIcon } from '@heroicons/react/24/outline';

// Quick-pick status presets (like Slack)
const STATUS_PRESETS = [
  { emoji: '📅', text: 'In a meeting' },
  { emoji: '🚌', text: 'Commuting' },
  { emoji: '🤒', text: 'Out sick' },
  { emoji: '🌴', text: 'Vacationing' },
  { emoji: '🏠', text: 'Working remotely' },
  { emoji: '🔕', text: 'Do not disturb' },
  { emoji: '🎯', text: 'Focusing' },
  { emoji: '☕', text: 'On a break' },
];

const COMMON_EMOJIS = [
  '😀', '😊', '🎉', '🔥', '🚀', '💪', '👀', '✅',
  '❤️', '💯', '🙏', '✨', '📅', '🏠', '🤒', '🌴',
  '🎯', '☕', '🔕', '🚌', '💡', '📝', '🎵', '⚡',
];

interface StatusPickerProps {
  currentStatus?: string | null;
  currentEmoji?: string | null;
  onSave: (status: string | null, emoji: string | null) => void;
  onClose: () => void;
}

export default function StatusPicker({
  currentStatus,
  currentEmoji,
  onSave,
  onClose,
}: StatusPickerProps) {
  const [statusText, setStatusText] = useState(currentStatus || '');
  const [statusEmoji, setStatusEmoji] = useState(currentEmoji || '');
  const [showEmojiGrid, setShowEmojiGrid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSave = () => {
    onSave(statusText.trim() || null, statusEmoji.trim() || null);
  };

  const handleClear = () => {
    onSave(null, null);
  };

  const handlePresetClick = (preset: { emoji: string; text: string }) => {
    setStatusEmoji(preset.emoji);
    setStatusText(preset.text);
  };

  return (
    <div
      ref={panelRef}
      className="w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden max-h-[80vh] overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Set a status</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Input section */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-600 focus-within:ring-2 focus-within:ring-blue-500">
          <button
            onClick={() => setShowEmojiGrid((p) => !p)}
            className="text-lg hover:scale-110 transition-transform flex-shrink-0"
            title="Pick emoji"
          >
            {statusEmoji || <FaceSmileIcon className="w-5 h-5 text-gray-400" />}
          </button>
          <input
            ref={inputRef}
            type="text"
            value={statusText}
            onChange={(e) => setStatusText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
            placeholder="What's your status?"
            maxLength={200}
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none"
          />
          {(statusText || statusEmoji) && (
            <button
              onClick={() => {
                setStatusText('');
                setStatusEmoji('');
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Emoji mini-grid */}
        {showEmojiGrid && (
          <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg max-h-32 overflow-auto">
            <div className="grid grid-cols-8 gap-1 min-w-0">
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    setStatusEmoji(emoji);
                    setShowEmojiGrid(false);
                  }}
                  className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors flex-shrink-0"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Presets */}
      <div className="px-4 pb-2">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Quick presets</p>
        <div className="space-y-0.5 max-h-40 overflow-y-auto">
          {STATUS_PRESETS.map((preset) => (
            <button
              key={preset.text}
              onClick={() => handlePresetClick(preset)}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="text-base">{preset.emoji}</span>
              <span>{preset.text}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
        <button
          onClick={handleClear}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
        >
          Clear status
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );
}
