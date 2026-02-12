'use client';

import { useState } from 'react';
import {
  CheckIcon, XMarkIcon, PencilIcon,
  PlusCircleIcon, ArrowPathIcon, PauseCircleIcon, TrashIcon,
  ChevronDownIcon, ChevronUpIcon,
} from '@heroicons/react/24/outline';
import { useStore, Suggestion } from '@/stores/useStore';

interface SuggestionReviewProps {
  suggestions: Suggestion[];
  sourceId: string;
  onComplete?: () => void;
}

const CHANGE_TYPE_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  add: { label: 'Add', color: 'bg-green-100 text-green-700', icon: PlusCircleIcon },
  modify: { label: 'Modify', color: 'bg-blue-100 text-blue-700', icon: ArrowPathIcon },
  defer: { label: 'Defer', color: 'bg-amber-100 text-amber-700', icon: PauseCircleIcon },
  remove: { label: 'Remove', color: 'bg-red-100 text-red-700', icon: TrashIcon },
};

export default function SuggestionReview({ suggestions, sourceId, onComplete }: SuggestionReviewProps) {
  const [decisions, setDecisions] = useState<Record<string, { approved: boolean; editedTitle?: string; editedDescription?: string }>>({});
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [editingSuggestion, setEditingSuggestion] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const { applyDecisions } = useStore();

  const pendingSuggestions = suggestions.filter((suggestion) => suggestion.is_approved === null);
  const decidedCount = Object.keys(decisions).length;
  const allDecided = decidedCount === pendingSuggestions.length && pendingSuggestions.length > 0;

  const handleApprove = (suggestionId: string) => {
    setDecisions((previous) => ({ ...previous, [suggestionId]: { ...previous[suggestionId], approved: true } }));
  };

  const handleReject = (suggestionId: string) => {
    setDecisions((previous) => ({ ...previous, [suggestionId]: { ...previous[suggestionId], approved: false } }));
  };

  const handleApproveAll = () => {
    const newDecisions: Record<string, any> = {};
    pendingSuggestions.forEach((suggestion) => {
      newDecisions[suggestion.id] = { approved: true };
    });
    setDecisions(newDecisions);
  };

  const handleRejectAll = () => {
    const newDecisions: Record<string, any> = {};
    pendingSuggestions.forEach((suggestion) => {
      newDecisions[suggestion.id] = { approved: false };
    });
    setDecisions(newDecisions);
  };

  const handleApplyAll = async () => {
    setIsApplying(true);
    try {
      const decisionList = Object.entries(decisions).map(([suggestionId, decision]) => ({
        suggestion_id: suggestionId,
        is_approved: decision.approved,
        edited_title: decision.editedTitle,
        edited_description: decision.editedDescription,
      }));

      await applyDecisions(decisionList);
      onComplete?.();
    } catch {
      // error handled by store
    } finally {
      setIsApplying(false);
    }
  };

  if (pendingSuggestions.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-500">
        <p className="text-sm">All suggestions have been reviewed.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with bulk actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-600">
          <span className="font-medium">{pendingSuggestions.length}</span> suggestions to review
          {decidedCount > 0 && (
            <span className="ml-2 text-primary-600">({decidedCount} decided)</span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleApproveAll}
            className="text-xs px-3 py-1 rounded-md bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
          >
            Approve All
          </button>
          <button
            onClick={handleRejectAll}
            className="text-xs px-3 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
          >
            Reject All
          </button>
        </div>
      </div>

      {/* Suggestion Cards */}
      <div className="space-y-3">
        {pendingSuggestions.map((suggestion) => {
          const config = CHANGE_TYPE_CONFIG[suggestion.change_type] || CHANGE_TYPE_CONFIG.add;
          const decision = decisions[suggestion.id];
          const isExpanded = expandedSuggestion === suggestion.id;
          const isEditing = editingSuggestion === suggestion.id;
          const ChangeIcon = config.icon;

          return (
            <div
              key={suggestion.id}
              className={`rounded-xl border-2 transition-all ${
                decision?.approved === true
                  ? 'border-green-300 bg-green-50/50'
                  : decision?.approved === false
                  ? 'border-red-300 bg-red-50/50 opacity-60'
                  : 'border-neutral-200 bg-white'
              }`}
            >
              <div className="p-4">
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${config.color}`}>
                      <ChangeIcon className="w-3.5 h-3.5" />
                      {config.label}
                    </span>
                    <div className="flex-1">
                      <h4 className="font-medium text-neutral-900 text-sm">{suggestion.title}</h4>
                      {suggestion.description && (
                        <p className="text-xs text-neutral-600 mt-1 line-clamp-2">{suggestion.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Confidence */}
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="w-16 h-1.5 rounded-full bg-neutral-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          suggestion.confidence > 0.7 ? 'bg-green-500' :
                          suggestion.confidence > 0.4 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${suggestion.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-neutral-500">{Math.round(suggestion.confidence * 100)}%</span>
                  </div>
                </div>

                {/* Expand toggle */}
                <button
                  onClick={() => setExpandedSuggestion(isExpanded ? null : suggestion.id)}
                  className="flex items-center gap-1 mt-2 text-xs text-neutral-500 hover:text-neutral-700"
                >
                  {isExpanded ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
                  {isExpanded ? 'Less' : 'More details'}
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-neutral-200 space-y-2">
                    {suggestion.source_quote && (
                      <div>
                        <p className="text-xs font-medium text-neutral-500 mb-1">Source Quote</p>
                        <blockquote className="text-xs text-neutral-700 italic border-l-2 border-primary-300 pl-3">
                          &ldquo;{suggestion.source_quote}&rdquo;
                        </blockquote>
                      </div>
                    )}
                    {suggestion.reasoning && (
                      <div>
                        <p className="text-xs font-medium text-neutral-500 mb-1">Reasoning</p>
                        <p className="text-xs text-neutral-600">{suggestion.reasoning}</p>
                      </div>
                    )}
                    {suggestion.acceptance_criteria && suggestion.acceptance_criteria.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-neutral-500 mb-1">Acceptance Criteria</p>
                        <ul className="text-xs text-neutral-600 space-y-1">
                          {suggestion.acceptance_criteria.map((criterion, index) => (
                            <li key={index} className="flex items-start gap-1">
                              <span className="text-neutral-400 mt-0.5">•</span>
                              {criterion}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => handleApprove(suggestion.id)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      decision?.approved === true
                        ? 'bg-green-600 text-white'
                        : 'bg-green-50 text-green-700 hover:bg-green-100'
                    }`}
                  >
                    <CheckIcon className="w-3.5 h-3.5" />
                    {decision?.approved === true ? 'Approved' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleReject(suggestion.id)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      decision?.approved === false
                        ? 'bg-red-600 text-white'
                        : 'bg-red-50 text-red-700 hover:bg-red-100'
                    }`}
                  >
                    <XMarkIcon className="w-3.5 h-3.5" />
                    {decision?.approved === false ? 'Rejected' : 'Reject'}
                  </button>
                  <button
                    onClick={() => setEditingSuggestion(isEditing ? null : suggestion.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-50 text-neutral-600 hover:bg-neutral-100 transition-all"
                  >
                    <PencilIcon className="w-3.5 h-3.5" />
                    Edit
                  </button>
                </div>

                {/* Inline edit */}
                {isEditing && (
                  <div className="mt-3 pt-3 border-t border-neutral-200 space-y-2">
                    <input
                      type="text"
                      defaultValue={suggestion.title}
                      onChange={(e) =>
                        setDecisions((previous) => ({
                          ...previous,
                          [suggestion.id]: { ...previous[suggestion.id], approved: true, editedTitle: e.target.value },
                        }))
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 text-sm"
                      placeholder="Edit title..."
                    />
                    <textarea
                      defaultValue={suggestion.description || ''}
                      onChange={(e) =>
                        setDecisions((previous) => ({
                          ...previous,
                          [suggestion.id]: { ...previous[suggestion.id], approved: true, editedDescription: e.target.value },
                        }))
                      }
                      rows={2}
                      className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 text-sm"
                      placeholder="Edit description..."
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Apply button */}
      {decidedCount > 0 && (
        <div className="flex justify-end pt-2">
          <button
            onClick={handleApplyAll}
            disabled={isApplying}
            className="px-6 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-medium 
                       hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50 
                       flex items-center gap-2"
          >
            {isApplying ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Applying...
              </>
            ) : (
              `Apply ${decidedCount} Decision${decidedCount !== 1 ? 's' : ''}`
            )}
          </button>
        </div>
      )}
    </div>
  );
}
