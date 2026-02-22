'use client';

import { useState } from 'react';
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { TeamMember } from '@/stores/useStore';

interface TeamSelectorProps {
  sessionId: string;
  teamMembers: TeamMember[];
  onAddMember: (data: { name: string; email?: string; role?: string }) => Promise<any>;
  onRemoveMember: (teamMemberId: string) => Promise<void>;
  onClose: () => void;
}

const ROLE_OPTIONS = ['developer', 'designer', 'pm', 'qa', 'devops', 'analyst', 'other'];

export default function TeamSelector({
  sessionId, teamMembers, onAddMember, onRemoveMember, onClose,
}: TeamSelectorProps) {
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('developer');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddMember = async () => {
    if (!memberName.trim()) return;

    setIsAdding(true);
    try {
      await onAddMember({
        name: memberName.trim(),
        email: memberEmail.trim() || undefined,
        role: memberRole,
      });
      setMemberName('');
      setMemberEmail('');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="border-b border-neutral-200 bg-white px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-neutral-800">Team Members</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-neutral-100">
          <XMarkIcon className="w-4 h-4 text-neutral-500" />
        </button>
      </div>

      {/* Add member form */}
      <div className="flex items-end gap-2 mb-3">
        <div className="flex-1">
          <label className="block text-xs text-neutral-500 mb-1">Name</label>
          <input
            type="text"
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            placeholder="e.g., John Smith"
            className="w-full px-2.5 py-1.5 rounded-md border border-neutral-300 text-sm 
                       focus:border-neutral-400 focus:ring-1 focus:ring-neutral-200 outline-none"
            onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
          />
        </div>
        <div className="w-44">
          <label className="block text-xs text-neutral-500 mb-1">Email</label>
          <input
            type="email"
            value={memberEmail}
            onChange={(e) => setMemberEmail(e.target.value)}
            placeholder="john@company.com"
            className="w-full px-2.5 py-1.5 rounded-md border border-neutral-300 text-sm 
                       focus:border-neutral-400 focus:ring-1 focus:ring-neutral-200 outline-none"
          />
        </div>
        <div className="w-32">
          <label className="block text-xs text-neutral-500 mb-1">Role</label>
          <select
            value={memberRole}
            onChange={(e) => setMemberRole(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-md border border-neutral-300 text-sm 
                       focus:border-neutral-400 outline-none"
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleAddMember}
          disabled={isAdding || !memberName.trim()}
          className="px-3 py-1.5 rounded-md bg-neutral-900 text-white text-sm font-medium
                     hover:bg-neutral-800 transition-colors disabled:opacity-50"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Member list */}
      {teamMembers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {teamMembers.map((member) => (
            <div
              key={member.id}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100 
                         text-sm group"
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                style={{ backgroundColor: member.avatar_color || '#6366f1' }}
              >
                {member.name[0]}
              </span>
              <span className="text-neutral-800 font-medium">{member.name}</span>
              {member.role && (
                <span className="text-neutral-500 text-xs">({member.role})</span>
              )}
              <button
                onClick={() => onRemoveMember(member.id)}
                className="hidden group-hover:block"
              >
                <TrashIcon className="w-3.5 h-3.5 text-neutral-400 hover:text-red-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      {teamMembers.length === 0 && (
        <p className="text-xs text-neutral-400">No team members yet. Add members to assign cards.</p>
      )}
    </div>
  );
}
