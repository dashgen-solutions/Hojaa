'use client';

import { motion } from 'framer-motion';
import VoteButton from './VoteButton';
import type { RoadmapItemType } from './types';
import { ICON_MAP } from './types';

interface RoadmapCardProps {
  item: RoadmapItemType;
  onVote: (id: string) => void;
  isAuthenticated: boolean;
}

export default function RoadmapCard({ item, onVote, isAuthenticated }: RoadmapCardProps) {
  const icon = item.icon_name ? ICON_MAP[item.icon_name] || '\u{2728}' : '\u{2728}';
  const isShipped = item.status === 'shipped';

  return (
    <motion.div
      className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 hover:border-brand-lime/20 transition-all duration-300"
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* Top: icon + title */}
      <div className="flex items-start gap-2">
        <span className="text-base flex-shrink-0 mt-0.5" role="img" aria-hidden="true">
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-white text-sm leading-snug truncate">
              {item.title}
            </h4>
            {isShipped && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 bg-green-500/10 text-green-400 text-2xs px-2 py-0.5 rounded-full">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M2 5L4.5 7.5L8 3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Shipped
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Middle: description */}
      {item.description && (
        <p className="text-xs text-neutral-500 line-clamp-2 mt-1 ml-6">
          {item.description}
        </p>
      )}

      {/* Bottom row: inspired_by tag + vote button */}
      <div className="flex items-center justify-between mt-3 ml-6">
        <div>
          {item.inspired_by && (
            <span className="text-2xs text-neutral-600 bg-neutral-800/50 px-2 py-0.5 rounded-full">
              Inspired by {item.inspired_by}
            </span>
          )}
        </div>
        <VoteButton
          count={item.vote_count}
          voted={item.user_has_voted}
          onClick={() => onVote(item.id)}
          disabled={!isAuthenticated}
        />
      </div>
    </motion.div>
  );
}
