'use client';

import { useState } from 'react';
import { CalendarIcon, ClockIcon, UserPlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { PlanningCard as PlanningCardType, TeamMember } from '@/stores/useStore';

interface PlanningCardProps {
  card: PlanningCardType;
  teamMembers: TeamMember[];
  onDragStart: () => void;
  onAssign: (teamMemberId: string) => void;
  onUnassign: (teamMemberId: string) => void;
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
}: PlanningCardProps) {
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);

  const assignedMemberIds = new Set(card.assignments.map((assignment) => assignment.team_member_id));
  const unassignedMembers = teamMembers.filter((member) => !assignedMemberIds.has(member.id));

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="bg-white rounded-lg border border-neutral-200 p-3 shadow-sm 
                 hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
    >
      {/* Tags row */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${NODE_TYPE_STYLES[card.node_type] || NODE_TYPE_STYLES.feature}`}>
          {card.node_type}
        </span>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${PRIORITY_STYLES[card.priority] || PRIORITY_STYLES.medium}`}>
          {card.priority}
        </span>
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium text-neutral-900 line-clamp-2">{card.node_title}</h4>

      {/* Description (truncated) */}
      {card.node_description && (
        <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{card.node_description}</p>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-3 mt-3 text-neutral-400">
        {card.due_date && (
          <span className="inline-flex items-center gap-1 text-[10px]">
            <CalendarIcon className="w-3 h-3" />
            {new Date(card.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
        {card.estimated_hours && (
          <span className="inline-flex items-center gap-1 text-[10px]">
            <ClockIcon className="w-3 h-3" />
            {card.estimated_hours}h
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
              onClick={(event) => {
                event.stopPropagation();
                onUnassign(assignment.team_member_id);
              }}
              className="hidden group-hover:block"
            >
              <XMarkIcon className="w-3 h-3 text-neutral-400 hover:text-red-500" />
            </button>
          </span>
        ))}

        {/* Add assignee button */}
        <div className="relative">
          <button
            onClick={() => setShowAssignDropdown(!showAssignDropdown)}
            className="w-5 h-5 rounded-full border border-dashed border-neutral-300 
                       flex items-center justify-center hover:border-primary-400 
                       hover:bg-primary-50 transition-colors"
          >
            <UserPlusIcon className="w-3 h-3 text-neutral-400" />
          </button>

          {showAssignDropdown && unassignedMembers.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 w-40 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-10">
              {unassignedMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={() => {
                    onAssign(member.id);
                    setShowAssignDropdown(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 
                             flex items-center gap-2"
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
    </div>
  );
}
