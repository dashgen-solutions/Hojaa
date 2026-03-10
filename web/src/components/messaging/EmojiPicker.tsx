'use client';

import React, { useState, useRef, useEffect } from 'react';

// Curated emoji set organized by category (Slack-style)
const EMOJI_CATEGORIES: Record<string, { label: string; emojis: string[] }> = {
  frequent: {
    label: '⏱ Frequently Used',
    emojis: ['👍', '❤️', '😂', '🎉', '🔥', '👀', '✅', '🙏', '💯', '🚀'],
  },
  smileys: {
    label: '😀 Smileys',
    emojis: [
      '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂',
      '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛',
      '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
      '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮', '😯', '😲',
      '😳', '🥺', '😢', '😭', '😤', '😡', '🤬', '😈', '👿', '💀',
      '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾',
    ],
  },
  people: {
    label: '👋 People',
    emojis: [
      '👋', '🤚', '🖐', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
      '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
      '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🙏',
      '💪', '🦾', '🧠', '👀', '👁', '👅', '👄',
    ],
  },
  nature: {
    label: '🌿 Nature',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
      '🦁', '🐮', '🐷', '🌸', '🌺', '🌻', '🌹', '🌷', '🌱', '🌲',
      '🌳', '🍀', '🌈', '⭐', '🌙', '☀️', '🌤', '⛅', '🌧', '❄️',
    ],
  },
  food: {
    label: '🍕 Food',
    emojis: [
      '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍒', '🍑',
      '🍕', '🍔', '🍟', '🌭', '🍿', '🍩', '🍪', '🎂', '🍰', '☕',
      '🍵', '🥤', '🍺', '🍷', '🥂', '🧋',
    ],
  },
  activities: {
    label: '⚽ Activities',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🎱', '🏓', '🎯',
      '🎮', '🕹', '🎲', '🧩', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼',
      '🎹', '🥁', '🎷', '🎺', '🎸', '🎻', '🏆', '🥇', '🥈', '🥉',
    ],
  },
  objects: {
    label: '💡 Objects',
    emojis: [
      '💡', '🔦', '📱', '💻', '⌨️', '🖥', '📷', '📹', '📞', '📧',
      '📝', '📌', '📎', '✂️', '📁', '📂', '🗂', '📊', '📈', '📉',
      '🔒', '🔑', '🔨', '🛠', '⚙️', '🧲', '🔬', '🧪', '💊', '🎁',
    ],
  },
  symbols: {
    label: '❤️ Symbols',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '✅', '❌',
      '⭕', '❗', '❓', '‼️', '⁉️', '💯', '🔥', '✨', '🌟', '💫',
      '⚡', '🎉', '🎊', '🚀', '🏁', '🔔', '🔕', '💬', '👁‍🗨', '♻️',
    ],
  },
  flags: {
    label: '🏳 Flags',
    emojis: [
      '🏳', '🏴', '🏁', '🚩', '🏳️‍🌈', '🏳️‍⚧️', '🇺🇸', '🇬🇧', '🇨🇦', '🇦🇺',
      '🇩🇪', '🇫🇷', '🇯🇵', '🇰🇷', '🇨🇳', '🇮🇳', '🇧🇷', '🇲🇽', '🇪🇸', '🇮🇹',
    ],
  },
};

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('frequent');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Filter emojis by search term
  const filteredCategories = search
    ? Object.entries(EMOJI_CATEGORIES).reduce<Record<string, string[]>>((acc, [key, cat]) => {
        const filtered = cat.emojis.filter((e) => e.includes(search));
        if (filtered.length > 0) acc[key] = filtered;
        return acc;
      }, {})
    : null;

  const categoryKeys = Object.keys(EMOJI_CATEGORIES);

  return (
    <div
      ref={ref}
      className="absolute bottom-12 left-0 w-80 bg-[#1a1d21] border border-[#383a3f] rounded-lg shadow-2xl z-50 flex flex-col"
      style={{ maxHeight: '360px' }}
    >
      {/* Search */}
      <div className="p-2 border-b border-[#383a3f]">
        <input
          type="text"
          placeholder="Search emoji..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#222529] border border-[#383a3f] rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          autoFocus
        />
      </div>

      {/* Category tabs */}
      {!search && (
        <div className="flex border-b border-[#383a3f] px-1">
          {categoryKeys.map((key) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`px-2 py-1.5 text-xs flex-1 transition-colors ${
                activeCategory === key
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              title={EMOJI_CATEGORIES[key].label}
            >
              {EMOJI_CATEGORIES[key].emojis[0]}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div className="flex-1 overflow-y-auto p-2" style={{ maxHeight: '240px' }}>
        {search && filteredCategories ? (
          Object.entries(filteredCategories).map(([key, emojis]) => (
            <div key={key} className="mb-2">
              <div className="text-xs text-gray-500 mb-1">{EMOJI_CATEGORIES[key]?.label}</div>
              <div className="grid grid-cols-8 gap-0.5">
                {emojis.map((emoji, i) => (
                  <button
                    key={`${key}-${i}`}
                    onClick={() => { onSelect(emoji); onClose(); }}
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#383a3f] transition-colors text-lg"
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div>
            <div className="text-xs text-gray-500 mb-1">
              {EMOJI_CATEGORIES[activeCategory]?.label}
            </div>
            <div className="grid grid-cols-8 gap-0.5">
              {EMOJI_CATEGORIES[activeCategory]?.emojis.map((emoji, i) => (
                <button
                  key={i}
                  onClick={() => { onSelect(emoji); onClose(); }}
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#383a3f] transition-colors text-lg"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {search && filteredCategories && Object.keys(filteredCategories).length === 0 && (
          <div className="text-center text-gray-500 text-sm py-6">No emojis found</div>
        )}
      </div>
    </div>
  );
}
