'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

// Comprehensive emoji set organized by category (Slack-style)
const EMOJI_CATEGORIES: Record<string, { label: string; emojis: string[] }> = {
  frequent: {
    label: '⏱ Frequently Used',
    emojis: ['👍', '❤️', '😂', '🎉', '🔥', '👀', '✅', '🙏', '💯', '🚀', '👏', '😍', '🙌', '💪', '😊', '✨'],
  },
  smileys: {
    label: '😀 Smileys & Emotion',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
      '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '☺️', '😚',
      '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭',
      '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '🫥', '😏',
      '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷',
      '🤒', '🤕', '🤢', '🤮', '🥵', '🥶', '🥴', '😵', '😵‍💫', '🤯',
      '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '🫤', '😟', '🙁',
      '☹️', '😮', '😯', '😲', '😳', '🥺', '🥹', '😦', '😧', '😨',
      '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩',
      '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️',
      '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '😺', '😸',
      '😹', '😻', '😼', '😽', '🙀', '😿', '😾',
      '🫶', '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓', '💗', '💖', '💘', '💝',
      '💟', '❣️', '💔', '🩷', '🧡', '💛', '💚', '💙', '🩵', '💜',
      '🤎', '🖤', '🤍', '💋', '💌', '💐', '🌹',
    ],
  },
  people: {
    label: '👋 People & Body',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳', '🫴', '🫷',
      '🫸', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙',
      '👈', '👉', '👆', '🖕', '👇', '☝️', '🫵', '👍', '👎', '✊',
      '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏',
      '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻',
      '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄',
      '🫦', '👶', '🧒', '👦', '👧', '🧑', '👱', '👨', '🧔', '👩',
      '🧓', '👴', '👵', '🙍', '🙎', '🙅', '🙆', '💁', '🙋', '🧏',
      '🙇', '🤦', '🤷', '👮', '🕵️', '💂', '🥷', '👷', '🫅', '🤴',
      '👸', '👳', '👲', '🧕', '🤵', '👰', '🤰', '🫃', '🫄', '🤱',
      '👼', '🎅', '🤶', '🦸', '🦹', '🧙', '🧚', '🧛', '🧜', '🧝',
      '🧞', '🧟', '🧌', '💆', '💇', '🚶', '🧍', '🧎', '🏃', '💃',
      '🕺', '🕴️', '👯', '🧖', '🧗', '🤸', '⛹️', '🏋️', '🤼', '🤽',
    ],
  },
  nature: {
    label: '🌿 Animals & Nature',
    emojis: [
      '🐶', '🐕', '🦮', '🐕‍🦺', '🐩', '🐺', '🦊', '🦝', '🐱', '🐈',
      '🐈‍⬛', '🦁', '🐯', '🐅', '🐆', '🐴', '🫎', '🫏', '🐎', '🦄',
      '🦓', '🦌', '🦬', '🐮', '🐂', '🐃', '🐄', '🐷', '🐖', '🐗',
      '🐽', '🐏', '🐑', '🐐', '🐪', '🐫', '🦙', '🦒', '🐘', '🦣',
      '🦏', '🦛', '🐭', '🐁', '🐀', '🐹', '🐰', '🐇', '🐿️', '🦫',
      '🦔', '🦇', '🐻', '🐻‍❄️', '🐨', '🐼', '🦥', '🦦', '🦨', '🦘',
      '🦡', '🐾', '🦃', '🐔', '🐓', '🐣', '🐤', '🐥', '🐦', '🐧',
      '🕊️', '🦅', '🦆', '🦢', '🦉', '🦤', '🪶', '🦩', '🦚', '🦜',
      '🪽', '🐦‍⬛', '🪿', '🐸', '🐊', '🐢', '🦎', '🐍', '🐲', '🐉',
      '🦕', '🦖', '🐳', '🐋', '🐬', '🦭', '🐟', '🐠', '🐡', '🦈',
      '🐙', '🐚', '🪸', '🪼', '🐌', '🦋', '🐛', '🐜', '🐝', '🪲',
      '🐞', '🦗', '🪳', '🕷️', '🕸️', '🦂', '🦟', '🪰', '🪱', '🦠',
      '💐', '🌸', '💮', '🪷', '🏵️', '🌹', '🥀', '🌺', '🌻', '🌼',
      '🌷', '🪻', '🌱', '🪴', '🌲', '🌳', '🌴', '🌵', '🌾', '🌿',
      '☘️', '🍀', '🍁', '🍂', '🍃', '🪹', '🪺', '🍄', '🌰', '🦀',
      '🦞', '🦐', '🦑', '🪐', '🌍', '🌎', '🌏', '🌕', '🌖', '🌗',
      '🌘', '🌑', '🌒', '🌓', '🌔', '🌚', '🌝', '🌙', '⭐', '🌟',
      '💫', '✨', '☄️', '🌞', '☀️', '🌤️', '⛅', '🌥️', '🌦️', '🌧️',
      '⛈️', '🌩️', '🌨️', '❄️', '☃️', '⛄', '🌬️', '💨', '🌪️', '🌫️',
      '🌈', '☔', '⚡', '🔥', '💧', '🌊',
    ],
  },
  food: {
    label: '🍕 Food & Drink',
    emojis: [
      '🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🍏',
      '🍐', '🍑', '🍒', '🍓', '🫐', '🥝', '🍅', '🫒', '🥥', '🥑',
      '🍆', '🥔', '🥕', '🌽', '🌶️', '🫑', '🥒', '🥬', '🥦', '🧄',
      '🧅', '🥜', '🫘', '🌰', '🫚', '🫛', '🍞', '🥐', '🥖', '🫓',
      '🥨', '🥯', '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔',
      '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🫔', '🥙', '🧆', '🥚',
      '🍳', '🥘', '🍲', '🫕', '🥣', '🥗', '🍿', '🧈', '🧂', '🥫',
      '🍱', '🍘', '🍙', '🍚', '🍛', '🍜', '🍝', '🍠', '🍢', '🍣',
      '🍤', '🍥', '🥮', '🍡', '🥟', '🥠', '🥡', '🦪', '🍦', '🍧',
      '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭',
      '🍮', '🍯', '🍼', '🥛', '☕', '🫖', '🍵', '🧃', '🥤', '🧋',
      '🫧', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃',
      '🫗', '🥤', '🧊', '🥢', '🍽️', '🍴', '🥄', '🔪', '🫙', '🏺',
    ],
  },
  travel: {
    label: '🚗 Travel & Places',
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐',
      '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🛺', '🚲', '🛴', '🛹',
      '🛼', '🚏', '🛣️', '🛤️', '⛽', '🛞', '🚨', '🚥', '🚦', '🛑',
      '🚧', '⚓', '🛟', '⛵', '🛶', '🚤', '🛳️', '⛴️', '🛥️', '🚢',
      '✈️', '🛩️', '🛫', '🛬', '🪂', '💺', '🚁', '🚟', '🚠', '🚡',
      '🛰️', '🚀', '🛸', '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏢', '🏬',
      '🏣', '🏤', '🏥', '🏦', '🏨', '🏩', '🏪', '🏫', '🏭', '🏯',
      '🏰', '💒', '🗼', '🗽', '⛪', '🕌', '🛕', '🕍', '⛩️', '🕋',
      '⛲', '⛺', '🌁', '🌃', '🏙️', '🌄', '🌅', '🌆', '🌇', '🌉',
      '🎠', '🛝', '🎡', '🎢', '🎪', '🗺️', '🗿', '🏕️', '⛰️', '🌋',
    ],
  },
  activities: {
    label: '⚽ Activities',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
      '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳',
      '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷',
      '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️',
      '🤺', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗',
      '🚵', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️',
      '🎫', '🎟️', '🎪', '🤹', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧',
      '🎼', '🎹', '🥁', '🪘', '🎷', '🎺', '🪗', '🎸', '🪕', '🎻',
      '🪈', '🎲', '♟️', '🎯', '🎳', '🎮', '🕹️', '🧩', '🪄', '🪅',
      '🎰', '🎱',
    ],
  },
  objects: {
    label: '💡 Objects',
    emojis: [
      '👓', '🕶️', '🥽', '🥼', '🦺', '👔', '👕', '👖', '🧣', '🧤',
      '🧥', '🧦', '👗', '👘', '🥻', '🩱', '🩲', '🩳', '👙', '👚',
      '👛', '👜', '👝', '🎒', '🩴', '👞', '👟', '🥾', '🥿', '👠',
      '👡', '🩰', '👢', '👑', '👒', '🎩', '🧢', '🪖', '⛑️', '📿',
      '💄', '💍', '💎', '📱', '📲', '☎️', '📞', '📟', '📠', '🔋',
      '🪫', '🔌', '💻', '🖥️', '🖨️', '⌨️', '🖱️', '🖲️', '💽', '💾',
      '💿', '📀', '🧮', '🎥', '🎞️', '📽️', '🎬', '📺', '📷', '📸',
      '📹', '📼', '🔍', '🔎', '🕯️', '💡', '🔦', '🏮', '🪔', '📔',
      '📕', '📖', '📗', '📘', '📙', '📚', '📓', '📒', '📃', '📜',
      '📄', '📰', '🗞️', '📑', '🔖', '🏷️', '💰', '🪙', '💴', '💵',
      '💶', '💷', '💸', '💳', '🧾', '💹', '✉️', '📧', '📨', '📩',
      '📤', '📥', '📦', '📫', '📬', '📭', '📮', '🗳️', '✏️', '✒️',
      '🖊️', '🖋️', '📝', '💼', '📁', '📂', '🗂️', '📅', '📆', '🗒️',
      '🗓️', '📇', '📈', '📉', '📊', '📋', '📌', '📍', '📎', '🖇️',
      '📏', '📐', '✂️', '🗃️', '🗄️', '🗑️', '🔒', '🔓', '🔏', '🔐',
      '🔑', '🗝️', '🔨', '🪓', '⛏️', '⚒️', '🛠️', '🗡️', '⚔️', '💣',
      '🪃', '🏹', '🛡️', '🪚', '🔧', '🪛', '🔩', '⚙️', '🗜️', '⚖️',
      '🦯', '🔗', '⛓️', '🪝', '🧰', '🧲', '🪜', '💊', '💉', '🩸',
      '🩹', '🩺', '🩻', '🔬', '🔭', '📡', '🪬', '🏧', '🚮', '🎁',
    ],
  },
  symbols: {
    label: '❤️ Symbols',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '🩷',
      '🩵', '🩶', '❤️‍🔥', '❤️‍🩹', '💔', '❣️', '💕', '💞', '💓', '💗',
      '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️',
      '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋',
      '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️',
      '✅', '☑️', '✔️', '❌', '❎', '➕', '➖', '➗', '✖️', '💲',
      '❗', '❓', '‼️', '⁉️', '❕', '❔', '⭕', '🚫', '🔞', '📵',
      '🚭', '🚯', '🚱', '🚷', '💯', '🔥', '✨', '🌟', '💫', '⚡',
      '🎉', '🎊', '🎈', '🎀', '🎁', '🏁', '🚩', '🏴', '🏳️', '🏳️‍🌈',
      '🏳️‍⚧️', '🔔', '🔕', '💬', '💭', '🗯️', '♠️', '♣️', '♥️', '♦️',
      '🃏', '🀄', '🎴', '🔇', '🔈', '🔉', '🔊', '📢', '📣', '♻️',
      '⚠️', '🚸', '⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️',
      '↕️', '↔️', '↩️', '↪️', '⤴️', '⤵️', '🔃', '🔄', '🔙', '🔚',
      '🔛', '🔜', '🔝', '🔀', '🔁', '🔂', '▶️', '⏩', '⏭️', '⏯️',
      '◀️', '⏪', '⏮️', '🔼', '⏫', '🔽', '⏬', '⏸️', '⏹️', '⏺️',
      '⏏️', '🎦', '🔅', '🔆', '📶', '🛜', '📳', '📴',
    ],
  },
  flags: {
    label: '🏳️ Flags',
    emojis: [
      '🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️',
      '🇦🇫', '🇦🇱', '🇩🇿', '🇦🇸', '🇦🇩', '🇦🇴', '🇦🇬', '🇦🇷',
      '🇦🇲', '🇦🇺', '🇦🇹', '🇦🇿', '🇧🇸', '🇧🇭', '🇧🇩', '🇧🇧',
      '🇧🇾', '🇧🇪', '🇧🇿', '🇧🇯', '🇧🇹', '🇧🇴', '🇧🇦', '🇧🇼',
      '🇧🇷', '🇧🇳', '🇧🇬', '🇧🇫', '🇧🇮', '🇰🇭', '🇨🇲', '🇨🇦',
      '🇨🇱', '🇨🇳', '🇨🇴', '🇨🇷', '🇭🇷', '🇨🇺', '🇨🇾', '🇨🇿',
      '🇩🇰', '🇩🇴', '🇪🇨', '🇪🇬', '🇸🇻', '🇪🇪', '🇪🇹', '🇫🇮',
      '🇫🇷', '🇬🇪', '🇩🇪', '🇬🇭', '🇬🇷', '🇬🇹', '🇭🇹', '🇭🇳',
      '🇭🇰', '🇭🇺', '🇮🇸', '🇮🇳', '🇮🇩', '🇮🇷', '🇮🇶', '🇮🇪',
      '🇮🇱', '🇮🇹', '🇯🇲', '🇯🇵', '🇯🇴', '🇰🇿', '🇰🇪', '🇰🇼',
      '🇱🇧', '🇱🇾', '🇱🇹', '🇱🇺', '🇲🇾', '🇲🇻', '🇲🇱', '🇲🇹',
      '🇲🇽', '🇲🇦', '🇲🇿', '🇲🇲', '🇳🇵', '🇳🇱', '🇳🇿', '🇳🇬',
      '🇰🇵', '🇳🇴', '🇴🇲', '🇵🇰', '🇵🇸', '🇵🇦', '🇵🇾', '🇵🇪',
      '🇵🇭', '🇵🇱', '🇵🇹', '🇵🇷', '🇶🇦', '🇷🇴', '🇷🇺', '🇷🇼',
      '🇸🇦', '🇷🇸', '🇸🇬', '🇸🇰', '🇸🇮', '🇸🇴', '🇿🇦', '🇰🇷',
      '🇪🇸', '🇱🇰', '🇸🇩', '🇸🇪', '🇨🇭', '🇸🇾', '🇹🇼', '🇹🇭',
      '🇹🇷', '🇺🇦', '🇦🇪', '🇬🇧', '🇺🇸', '🇺🇾', '🇻🇪', '🇻🇳',
      '🇾🇪', '🇿🇲', '🇿🇼',
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
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Calculate position from anchor placeholder
  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const pickerHeight = 360;
      const pickerWidth = 320;

      let top = rect.top - pickerHeight - 8;
      let left = rect.left;

      // If would go off-screen top, position below
      if (top < 8) top = rect.bottom + 8;
      // Clamp within viewport
      if (top + pickerHeight > window.innerHeight - 8) {
        top = window.innerHeight - pickerHeight - 8;
      }
      if (left + pickerWidth > window.innerWidth - 8) {
        left = window.innerWidth - pickerWidth - 8;
      }
      if (left < 8) left = 8;

      setPos({ top, left });
    }
  }, []);

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

  const picker = (
    <div
      ref={ref}
      className="fixed w-80 bg-white dark:bg-[#1a1d21] border border-neutral-200 dark:border-[#383a3f] rounded-lg shadow-2xl flex flex-col"
      style={{
        maxHeight: '360px',
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        zIndex: 9999,
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      {/* Search */}
      <div className="p-2 border-b border-neutral-200 dark:border-[#383a3f] flex-shrink-0">
        <input
          type="text"
          placeholder="Search emoji..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-neutral-50 dark:bg-[#222529] border border-neutral-200 dark:border-[#383a3f] rounded px-3 py-1.5 text-sm text-neutral-800 dark:text-gray-200 placeholder-neutral-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500"
          autoFocus
        />
      </div>

      {/* Category tabs */}
      {!search && (
        <div className="flex overflow-x-auto border-b border-neutral-200 dark:border-[#383a3f] px-1 flex-shrink-0 scrollbar-hide">
          {categoryKeys.map((key) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`px-2 py-1.5 text-xs flex-shrink-0 transition-colors ${
                activeCategory === key
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-neutral-400 dark:text-gray-500 hover:text-neutral-600 dark:hover:text-gray-300'
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
              <div className="text-xs text-neutral-500 dark:text-gray-500 mb-1">{EMOJI_CATEGORIES[key]?.label}</div>
              <div className="grid grid-cols-8 gap-0.5">
                {emojis.map((emoji, i) => (
                  <button
                    key={`${key}-${i}`}
                    onClick={() => { onSelect(emoji); onClose(); }}
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-neutral-100 dark:hover:bg-[#383a3f] transition-colors text-lg"
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
            <div className="text-xs text-neutral-500 dark:text-gray-500 mb-1">
              {EMOJI_CATEGORIES[activeCategory]?.label}
            </div>
            <div className="grid grid-cols-8 gap-0.5">
              {EMOJI_CATEGORIES[activeCategory]?.emojis.map((emoji, i) => (
                <button
                  key={i}
                  onClick={() => { onSelect(emoji); onClose(); }}
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-neutral-100 dark:hover:bg-[#383a3f] transition-colors text-lg"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {search && filteredCategories && Object.keys(filteredCategories).length === 0 && (
          <div className="text-center text-neutral-400 dark:text-gray-500 text-sm py-6">No emojis found</div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <span ref={anchorRef} className="absolute bottom-12 left-0 w-0 h-0 pointer-events-none opacity-0" aria-hidden />
      {typeof document !== 'undefined' && createPortal(picker, document.body)}
    </>
  );
}
