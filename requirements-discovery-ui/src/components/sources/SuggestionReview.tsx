'use client';

import { useState, useEffect } from 'react';
import {
  CheckIcon, XMarkIcon, PencilIcon,
  PlusCircleIcon, ArrowPathIcon, PauseCircleIcon, TrashIcon,
  ChevronDownIcon, ChevronUpIcon, CheckCircleIcon, XCircleIcon, ClockIcon,
} from '@heroicons/react/24/outline';
import { useStore, Suggestion } from '@/stores/useStore';
import { getTree } from '@/lib/api';

// Flat node shape for comparison lookups
interface TreeNode {
  id: string;
  question: string;
  answer?: string;
  node_type: string;
  status?: string;
  children?: TreeNode[];
}

interface SuggestionReviewProps {
  suggestions: Suggestion[];
  sourceId: string;
  onComplete?: () => void;
  /** Session id used to fetch the graph tree for side-by-side comparison */
  sessionId?: string;
}

const CHANGE_TYPE_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  add: { label: 'Add', color: 'bg-green-100 text-green-700', icon: PlusCircleIcon },
  modify: { label: 'Modify', color: 'bg-blue-100 text-blue-700', icon: ArrowPathIcon },
  defer: { label: 'Defer', color: 'bg-amber-100 text-amber-700', icon: PauseCircleIcon },
  remove: { label: 'Remove', color: 'bg-red-100 text-red-700', icon: TrashIcon },
};

function SuggestionReadOnlyCard({ suggestion, status }: { suggestion: Suggestion; status: 'approved' | 'rejected' }) {
  const config = CHANGE_TYPE_CONFIG[suggestion.change_type] || CHANGE_TYPE_CONFIG.add;
  const ChangeIcon = config.icon;
  const borderBg = status === 'approved' ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/30';

  return (
    <div className={`rounded-lg border ${borderBg} p-3`}>
      <div className="flex items-start gap-2">
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${config.color}`}>
          <ChangeIcon className="w-3 h-3" />
          {config.label}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-800">{suggestion.title}</p>
          {suggestion.description && (
            <p className="text-xs text-neutral-600 mt-0.5 line-clamp-2">{suggestion.description}</p>
          )}
          {suggestion.reviewer_note && (
            <p className="text-xs text-neutral-500 mt-1 italic border-l-2 border-neutral-300 pl-2">
              Note: {suggestion.reviewer_note}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Flatten a recursive tree into a Record<id, node> for O(1) lookups. */
function flattenTree(nodes: TreeNode[]): Record<string, TreeNode> {
  const map: Record<string, TreeNode> = {};
  const walk = (list: TreeNode[]) => {
    for (const node of list) {
      map[node.id] = node;
      if (node.children?.length) walk(node.children);
    }
  };
  walk(nodes);
  return map;
}

export default function SuggestionReview({ suggestions, sourceId, onComplete, sessionId }: SuggestionReviewProps) {
  const [decisions, setDecisions] = useState<Record<string, { approved: boolean; editedTitle?: string; editedDescription?: string; reviewerNote?: string }>>({});
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [editingSuggestion, setEditingSuggestion] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);

  const { applyDecisions } = useStore();

  // Fetch tree data for side-by-side comparison
  useEffect(() => {
    if (!sessionId) return;
    const fetchNodes = async () => {
      try {
        const res = await getTree(sessionId);
        if (res?.tree) {
          // Normalize to an array so flattenTree can walk it
          setTreeNodes([res.tree]);
        }
      } catch {
        // Non-critical — comparison will simply be unavailable
      }
    };
    fetchNodes();
  }, [sessionId]);

  // Build flat lookup of current graph nodes for side-by-side comparison
  const nodeMap = treeNodes.length ? flattenTree(treeNodes) : {};

  const approvedSuggestions = suggestions.filter((s) => s.is_approved === true);
  const rejectedSuggestions = suggestions.filter((s) => s.is_approved === false);
  const pendingSuggestions = suggestions.filter((s) => s.is_approved === null);
  const decidedCount = Object.keys(decisions).length;

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
        reviewer_note: decision.reviewerNote,
      }));

      await applyDecisions(decisionList);
      onComplete?.();
    } catch {
      // error handled by store
    } finally {
      setIsApplying(false);
    }
  };

  // Summary line: X approved, Y rejected, Z pending
  const summaryParts = [];
  if (approvedSuggestions.length > 0) summaryParts.push(`${approvedSuggestions.length} approved`);
  if (rejectedSuggestions.length > 0) summaryParts.push(`${rejectedSuggestions.length} rejected`);
  if (pendingSuggestions.length > 0) summaryParts.push(`${pendingSuggestions.length} pending`);

  return (
    <div className="space-y-5">
      {/* Summary: approved / rejected / pending */}
      <div className="flex items-center gap-3 text-xs text-neutral-600">
        {summaryParts.length > 0 ? (
          <>
            {approvedSuggestions.length > 0 && (
              <span className="inline-flex items-center gap-1 text-green-600">
                <CheckCircleIcon className="w-3.5 h-3.5" />
                {approvedSuggestions.length} approved
              </span>
            )}
            {rejectedSuggestions.length > 0 && (
              <span className="inline-flex items-center gap-1 text-red-600">
                <XCircleIcon className="w-3.5 h-3.5" />
                {rejectedSuggestions.length} rejected
              </span>
            )}
            {pendingSuggestions.length > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-600">
                <ClockIcon className="w-3.5 h-3.5" />
                {pendingSuggestions.length} pending
              </span>
            )}
          </>
        ) : (
          <span className="text-neutral-400">No suggestions for this source.</span>
        )}
      </div>

      {/* ========== APPROVED (read-only) ========== */}
      {approvedSuggestions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1.5">
            <CheckCircleIcon className="w-4 h-4" />
            Approved ({approvedSuggestions.length})
          </h4>
          <div className="space-y-2">
            {approvedSuggestions.map((suggestion) => (
              <SuggestionReadOnlyCard key={suggestion.id} suggestion={suggestion} status="approved" />
            ))}
          </div>
        </div>
      )}

      {/* ========== REJECTED (read-only) ========== */}
      {rejectedSuggestions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-red-600 mb-2 flex items-center gap-1.5">
            <XCircleIcon className="w-4 h-4" />
            Rejected ({rejectedSuggestions.length})
          </h4>
          <div className="space-y-2">
            {rejectedSuggestions.map((suggestion) => (
              <SuggestionReadOnlyCard key={suggestion.id} suggestion={suggestion} status="rejected" />
            ))}
          </div>
        </div>
      )}

      {/* ========== PENDING (interactive) ========== */}
      {pendingSuggestions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-600">
              <span className="font-medium">{pendingSuggestions.length}</span> to review
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

          <div className="space-y-3">
            {pendingSuggestions.map((suggestion) => {
          const config = CHANGE_TYPE_CONFIG[suggestion.change_type] || CHANGE_TYPE_CONFIG.add;
          const decision = decisions[suggestion.id];
          const isExpanded = expandedSuggestion === suggestion.id;
          const isEditing = editingSuggestion === suggestion.id;
          const ChangeIcon = config.icon;

          // Resolve target node for side-by-side comparison (modify/defer/remove)
          const targetNode = suggestion.target_node_id ? nodeMap[suggestion.target_node_id] : null;
          const showComparison = targetNode && ['modify', 'defer', 'remove'].includes(suggestion.change_type);

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
                  <div className="mt-3 pt-3 border-t border-neutral-200 space-y-3">
                    {/* Side-by-side comparison for modify/defer/remove */}
                    {showComparison && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-2.5">
                          <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">Current</p>
                          <p className="text-xs font-medium text-neutral-800">{targetNode.question}</p>
                          {targetNode.answer && (
                            <p className="text-xs text-neutral-500 mt-1 line-clamp-3">{targetNode.answer}</p>
                          )}
                          {targetNode.status && (
                            <span className="inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-600">
                              {targetNode.status}
                            </span>
                          )}
                        </div>
                        <div className="rounded-lg border border-primary-200 bg-primary-50 p-2.5">
                          <p className="text-[10px] font-semibold text-primary-600 uppercase tracking-wider mb-1">Proposed</p>
                          <p className="text-xs font-medium text-primary-900">{suggestion.title}</p>
                          {suggestion.description && (
                            <p className="text-xs text-primary-700 mt-1 line-clamp-3">{suggestion.description}</p>
                          )}
                          <span className="inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded bg-primary-200 text-primary-700">
                            {suggestion.change_type}
                          </span>
                        </div>
                      </div>
                    )}
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

                {/* Reviewer note — visible once a decision is made */}
                {decision && (
                  <div className="mt-3 pt-3 border-t border-neutral-100">
                    <label className="text-xs font-medium text-neutral-500 mb-1 block">
                      Add a note <span className="font-normal text-neutral-400">(optional)</span>
                    </label>
                    <textarea
                      value={decision.reviewerNote || ''}
                      onChange={(e) =>
                        setDecisions((previous) => ({
                          ...previous,
                          [suggestion.id]: { ...previous[suggestion.id], reviewerNote: e.target.value },
                        }))
                      }
                      rows={2}
                      className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50
                                 focus:border-primary-300 focus:ring-1 focus:ring-primary-200 focus:bg-white transition-colors"
                      placeholder="Why you approved/rejected this, additional context..."
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
          </div>

          {/* Apply button — only when there are pending and some decided */}
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
      )}

      {/* When everything is reviewed and no suggestions at all */}
      {suggestions.length === 0 && (
        <p className="text-sm text-neutral-500 text-center py-4">No suggestions for this source.</p>
      )}
    </div>
  );
}
