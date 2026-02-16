'use client';

import { useState } from 'react';
import {
  CalendarIcon, ClockIcon, UserPlusIcon, XMarkIcon,
  CheckCircleIcon, ChatBubbleLeftIcon, PlusIcon,
  ChevronDownIcon, ChevronUpIcon, ExclamationTriangleIcon,
  ArrowPathIcon, TrashIcon, LinkIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import { PlanningCard as PlanningCardType, TeamMember, AcceptanceCriterionItem } from '@/stores/useStore';

interface PlanningCardProps {
  card: PlanningCardType;
  teamMembers: TeamMember[];
  onDragStart: () => void;
  onAssign: (teamMemberId: string) => void;
  onUnassign: (teamMemberId: string) => void;
  onToggleAC: (criterionId: string, checked: boolean) => void;
  onAddAC: (description: string) => void;
  onDeleteAC: (criterionId: string) => void;
  onAddComment: (content: string) => void;
  onUpdateCard: (updates: { title?: string; description?: string; estimated_hours?: number; actual_hours?: number }) => void;
  onConvertOutOfScope?: (parentNodeId: string) => void;
  onDelete?: () => void;
}

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-neutral-100 text-neutral-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};

const NODE_TYPE_STYLES: Record<string, string> = {
  feature: 'bg-primary-100 text-primary-700',
  detail: 'bg-accent-100 text-accent-700',
  root: 'bg-neutral-100 text-neutral-700',
};

export default function PlanningCardComponent({
  card, teamMembers, onDragStart, onAssign, onUnassign,
  onToggleAC, onAddAC, onDeleteAC, onAddComment, onUpdateCard,
  onConvertOutOfScope, onDelete,
}: PlanningCardProps) {
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [newACText, setNewACText] = useState('');
  const [newComment, setNewComment] = useState('');
  const [editingHours, setEditingHours] = useState(false);
  const [actualHours, setActualHours] = useState(card.actual_hours ?? 0);
  const [editingEstHours, setEditingEstHours] = useState(false);
  const [estHours, setEstHours] = useState(card.estimated_hours ?? 0);
  const [convertParentId, setConvertParentId] = useState('');
  const [showConvert, setShowConvert] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const assignedMemberIds = new Set(card.assignments.map((a) => a.team_member_id));
  const unassignedMembers = teamMembers.filter((m) => !assignedMemberIds.has(m.id));
  const acProgress = card.ac_total > 0 ? Math.round((card.ac_completed / card.ac_total) * 100) : 0;

  const handleAddAC = () => {
    if (newACText.trim()) {
      onAddAC(newACText.trim());
      setNewACText('');
    }
  };

  const handleAddComment = () => {
    if (newComment.trim()) {
      onAddComment(newComment.trim());
      setNewComment('');
    }
  };

  const handleSaveHours = () => {
    onUpdateCard({ actual_hours: actualHours });
    setEditingHours(false);
  };

  const handleSaveEstHours = () => {
    onUpdateCard({ estimated_hours: estHours });
    setEditingEstHours(false);
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`bg-white rounded-lg border p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing ${
        card.node_status === 'deferred'
          ? 'border-neutral-300 bg-neutral-50/60 opacity-75'
          : card.is_out_of_scope
            ? 'border-orange-300 bg-orange-50/30'
            : 'border-neutral-200'
      }`}
    >
      {/* Tags row */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${NODE_TYPE_STYLES[card.node_type] || NODE_TYPE_STYLES.feature}`}>
          {card.node_type}
        </span>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${PRIORITY_STYLES[card.priority] || PRIORITY_STYLES.medium}`}>
          {card.priority}
        </span>
        {card.is_out_of_scope && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 flex items-center gap-0.5">
            <ExclamationTriangleIcon className="w-3 h-3" /> Out of Scope
          </span>
        )}
        {card.node_status === 'deferred' && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-600 flex items-center gap-0.5">
            <ClockIcon className="w-3 h-3" /> Deferred
          </span>
        )}
        {card.node_status === 'completed' && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 flex items-center gap-0.5">
            <CheckCircleIcon className="w-3 h-3" /> Completed
          </span>
        )}
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium text-neutral-900 line-clamp-2">{card.node_title}</h4>

      {/* Description (truncated) */}
      {card.node_description && (
        <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{card.node_description}</p>
      )}

      {/* AC Progress mini-bar */}
      {card.ac_total > 0 && (
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-1 rounded-full bg-neutral-200 overflow-hidden">
            <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${acProgress}%` }} />
          </div>
          <span className="text-[10px] text-neutral-500">{card.ac_completed}/{card.ac_total}</span>
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-3 mt-2 text-neutral-400">
        {card.due_date && (
          <span className="inline-flex items-center gap-1 text-[10px]">
            <CalendarIcon className="w-3 h-3" />
            {new Date(card.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
        {card.estimated_hours != null && (
          <span className="inline-flex items-center gap-1 text-[10px]">
            <ClockIcon className="w-3 h-3" />
            {card.actual_hours ?? 0}/{card.estimated_hours}h
          </span>
        )}
        {card.comments.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px]">
            <ChatBubbleLeftIcon className="w-3 h-3" />
            {card.comments.length}
          </span>
        )}
      </div>

      {/* Assignees */}
      <div className="flex items-center gap-1 mt-2 flex-wrap">
        {card.assignments.map((assignment) => (
          <span
            key={assignment.id}
            className="inline-flex items-center gap-1 text-[10px] bg-neutral-100 text-neutral-700 
                       px-1.5 py-0.5 rounded-full group"
          >
            <span className="w-3 h-3 rounded-full bg-primary-400 text-white flex items-center justify-center text-[8px] font-bold">
              {assignment.team_member_name[0]}
            </span>
            {assignment.team_member_name}
            <button
              onClick={(e) => { e.stopPropagation(); onUnassign(assignment.team_member_id); }}
              className="hidden group-hover:block"
            >
              <XMarkIcon className="w-3 h-3 text-neutral-400 hover:text-red-500" />
            </button>
          </span>
        ))}

        {/* Add assignee */}
        <div className="relative">
          <button
            onClick={() => setShowAssignDropdown(!showAssignDropdown)}
            className="w-5 h-5 rounded-full border border-dashed border-neutral-300 
                       flex items-center justify-center hover:border-primary-400 hover:bg-primary-50 transition-colors"
          >
            <UserPlusIcon className="w-3 h-3 text-neutral-400" />
          </button>

          {showAssignDropdown && unassignedMembers.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 w-40 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-10">
              {unassignedMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={() => { onAssign(member.id); setShowAssignDropdown(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 flex items-center gap-2"
                >
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                    style={{ backgroundColor: member.avatar_color || '#6366f1' }}
                  >
                    {member.name[0]}
                  </span>
                  {member.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expand / Collapse toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full mt-2 flex items-center justify-center text-neutral-400 hover:text-neutral-600 text-[10px]"
      >
        {expanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
      </button>

      {/* Expanded Detail Panel */}
      {expanded && (
        <div className="mt-2 pt-2 border-t border-neutral-100 space-y-3">
          {/* Acceptance Criteria */}
          <div>
            <h5 className="text-[11px] font-semibold text-neutral-700 mb-1">Acceptance Criteria</h5>
            <ul className="space-y-1">
              {card.acceptance_criteria.map((ac: AcceptanceCriterionItem) => (
                <li key={ac.id} className="flex items-start gap-1.5 group">
                  <button onClick={() => onToggleAC(ac.id, !ac.is_completed)} className="mt-0.5 flex-shrink-0">
                    {ac.is_completed ? (
                      <CheckCircleSolid className="w-4 h-4 text-green-500" />
                    ) : (
                      <CheckCircleIcon className="w-4 h-4 text-neutral-300 hover:text-green-400" />
                    )}
                  </button>
                  <span className={`text-xs ${ac.is_completed ? 'line-through text-neutral-400' : 'text-neutral-700'}`}>
                    {ac.description}
                  </span>
                  {ac.node_id && (
                    <span title={`Linked to node ${ac.node_id}`} className="flex-shrink-0">
                      <LinkIcon className="w-3 h-3 text-primary-400" />
                    </span>
                  )}
                  <button
                    onClick={() => onDeleteAC(ac.id)}
                    className="ml-auto hidden group-hover:block flex-shrink-0"
                  >
                    <XMarkIcon className="w-3 h-3 text-neutral-400 hover:text-red-500" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-1 mt-1">
              <input
                type="text"
                placeholder="Add criterion..."
                value={newACText}
                onChange={(e) => setNewACText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddAC()}
                className="flex-1 text-xs px-2 py-1 border border-neutral-200 rounded"
              />
              <button onClick={handleAddAC} className="p-1 text-primary-600 hover:text-primary-800">
                <PlusIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Time Tracking */}
          <div>
            <h5 className="text-[11px] font-semibold text-neutral-700 mb-1">Time Tracking</h5>
            <div className="flex items-center gap-2 text-xs">
              {editingEstHours ? (
                <div className="flex items-center gap-1">
                  <span className="text-neutral-500">Est:</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={estHours}
                    onChange={(e) => setEstHours(parseFloat(e.target.value) || 0)}
                    className="w-16 text-xs px-1.5 py-0.5 border border-neutral-200 rounded"
                  />
                  <button onClick={handleSaveEstHours} className="text-primary-600 text-[10px] font-medium">Save</button>
                </div>
              ) : (
                <button
                  onClick={() => { setEstHours(card.estimated_hours ?? 0); setEditingEstHours(true); }}
                  className="text-neutral-500 hover:text-primary-600"
                >
                  Est: {card.estimated_hours ?? '-'}h
                </button>
              )}
              {editingHours ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={actualHours}
                    onChange={(e) => setActualHours(parseFloat(e.target.value) || 0)}
                    className="w-16 text-xs px-1.5 py-0.5 border border-neutral-200 rounded"
                  />
                  <button onClick={handleSaveHours} className="text-primary-600 text-[10px] font-medium">Save</button>
                </div>
              ) : (
                <button
                  onClick={() => { setActualHours(card.actual_hours ?? 0); setEditingHours(true); }}
                  className="text-neutral-500 hover:text-primary-600"
                >
                  Actual: {card.actual_hours ?? 0}h
                </button>
              )}
            </div>
          </div>

          {/* Comments */}
          <div>
            <h5 className="text-[11px] font-semibold text-neutral-700 mb-1">
              Notes &amp; Comments ({card.comments.length})
            </h5>
            {card.comments.slice(0, 5).map((c) => (
              <div key={c.id} className="text-xs text-neutral-600 mb-1 bg-neutral-50 rounded p-1.5">
                {c.author_name && <span className="font-medium text-neutral-800">{c.author_name}: </span>}
                {c.content}
                <span className="text-[9px] text-neutral-400 ml-1">
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-1 mt-1">
              <input
                type="text"
                placeholder="Add a note..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                className="flex-1 text-xs px-2 py-1 border border-neutral-200 rounded"
              />
              <button onClick={handleAddComment} className="p-1 text-primary-600 hover:text-primary-800">
                <ChatBubbleLeftIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Delete Card */}
          {onDelete && (
            <div>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600">Delete this card?</span>
                  <button
                    onClick={() => { onDelete(); setConfirmDelete(false); }}
                    className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Yes, delete
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs px-2 py-1 bg-neutral-200 text-neutral-700 rounded hover:bg-neutral-300"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                >
                  <TrashIcon className="w-3.5 h-3.5" /> Delete card
                </button>
              )}
            </div>
          )}

          {/* Out-of-scope: convert to graph */}
          {card.is_out_of_scope && onConvertOutOfScope && (
            <div>
              <h5 className="text-[11px] font-semibold text-orange-700 mb-1">Convert to In-Scope</h5>
              {showConvert ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="Parent node ID..."
                    value={convertParentId}
                    onChange={(e) => setConvertParentId(e.target.value)}
                    className="flex-1 text-xs px-2 py-1 border border-neutral-200 rounded"
                  />
                  <button
                    onClick={() => { if (convertParentId) onConvertOutOfScope(convertParentId); }}
                    disabled={!convertParentId}
                    className="text-xs px-2 py-1 bg-orange-600 text-white rounded disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowConvert(true)}
                  className="text-xs text-orange-600 hover:text-orange-800 flex items-center gap-1"
                >
                  <ArrowPathIcon className="w-3.5 h-3.5" /> Move to graph
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
