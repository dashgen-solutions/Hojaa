'use client';

import VoteButton from './VoteButton';
import type { FeatureRequestType } from './types';

interface FeatureRequestCardProps {
  request: FeatureRequestType;
  onVote: (id: string) => void;
  isAuthenticated: boolean;
}

function getRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 5) return `${diffWeeks}w ago`;
  return `${diffMonths}mo ago`;
}

export default function FeatureRequestCard({
  request,
  onVote,
  isAuthenticated,
}: FeatureRequestCardProps) {
  const isAccepted = request.status === 'accepted';

  return (
    <div className="bg-neutral-900/40 border border-neutral-800/50 rounded-xl p-4 flex gap-3">
      {/* Vote button on the left */}
      <div className="flex-shrink-0">
        <VoteButton
          count={request.vote_count}
          voted={request.user_has_voted}
          onClick={() => onVote(request.id)}
          disabled={!isAuthenticated}
        />
      </div>

      {/* Content on the right */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <h4 className="font-medium text-white text-sm leading-snug">{request.title}</h4>
          {isAccepted && (
            <span className="flex-shrink-0 bg-green-500/10 text-green-400 text-2xs px-2 py-0.5 rounded-full whitespace-nowrap">
              Added to Roadmap
            </span>
          )}
        </div>

        {request.description && (
          <p className="text-xs text-neutral-500 line-clamp-2 mt-1">{request.description}</p>
        )}

        <div className="flex items-center gap-2 mt-2">
          {request.user_display_name && (
            <span className="text-2xs text-neutral-600">
              by {request.user_display_name}
            </span>
          )}
          <span className="text-2xs text-neutral-600">
            {getRelativeTime(request.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}
