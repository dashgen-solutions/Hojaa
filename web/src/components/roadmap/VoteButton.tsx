'use client';

import { motion } from 'framer-motion';

interface VoteButtonProps {
  count: number;
  voted: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export default function VoteButton({ count, voted, onClick, disabled }: VoteButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center rounded-lg px-2 py-1.5 transition-all duration-200 min-w-[40px] ${
        voted
          ? 'border border-brand-lime bg-brand-lime/10 text-brand-lime'
          : 'border border-neutral-700 text-neutral-400 bg-transparent hover:border-brand-lime/50'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      aria-label={voted ? 'Remove vote' : 'Vote'}
    >
      {/* Chevron up arrow */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        className="mb-0.5"
      >
        <path
          d="M3 9L7 5L11 9"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-xs font-semibold leading-none">{count}</span>
    </motion.button>
  );
}
