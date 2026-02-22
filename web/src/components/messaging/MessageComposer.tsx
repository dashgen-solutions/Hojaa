"use client";

import { useState, useRef, useCallback } from "react";
import { PaperAirplaneIcon, LinkIcon } from "@heroicons/react/24/outline";

interface MessageComposerProps {
  onSend: (content: string, reference?: { type: string; id: string; name: string }) => void;
  onTyping: () => void;
  disabled?: boolean;
}

export default function MessageComposer({
  onSend,
  onTyping,
  disabled = false,
}: MessageComposerProps) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setContent("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);

    // Auto-resize textarea
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";

    // Typing indicator (debounced)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {}, 2000);
    onTyping();
  };

  return (
    <div className="border-t border-neutral-200 px-5 py-3 flex-shrink-0 bg-white">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none text-[13px] text-neutral-800 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-200 placeholder-neutral-400 disabled:opacity-50"
          style={{ maxHeight: "120px" }}
        />
        <button
          onClick={handleSend}
          disabled={!content.trim() || disabled}
          className="p-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          title="Send message"
        >
          <PaperAirplaneIcon className="w-4 h-4" />
        </button>
      </div>
      <p className="text-[10px] text-neutral-400 mt-1.5">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
