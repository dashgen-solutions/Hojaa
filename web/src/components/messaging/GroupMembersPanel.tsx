'use client';

import React, { useState } from 'react';
import { XMarkIcon, UserGroupIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import AddMembersModal from './AddMembersModal';

interface MemberInfo {
  user_id: string;
  username: string;
  email: string;
  is_online: boolean;
  custom_status?: string | null;
  status_emoji?: string | null;
}

interface GroupMembersPanelProps {
  members: MemberInfo[];
  onClose: () => void;
  channelName: string;
  channelId: string;
  onMembersChanged: () => void;
}

export default function GroupMembersPanel({ members, onClose, channelName, channelId, onMembersChanged }: GroupMembersPanelProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const onlineMembers = members.filter((m) => m.is_online);
  const offlineMembers = members.filter((m) => !m.is_online);

  return (
    <div className="w-[300px] border-l border-neutral-200 dark:border-[#383a3f] bg-white dark:bg-[#1e2024] flex flex-col h-full flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-[#383a3f]">
        <div className="flex items-center gap-2">
          <UserGroupIcon className="w-5 h-5 text-blue-400" />
          <h3 className="text-sm font-bold text-neutral-800 dark:text-gray-200">Members</h3>
          <span className="text-xs text-neutral-400 dark:text-gray-500">({members.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowAddModal(true)}
            className="p-1 rounded text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors"
            title="Add members"
          >
            <UserPlusIcon className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded text-neutral-400 dark:text-gray-400 hover:text-neutral-600 dark:hover:text-gray-200 hover:bg-neutral-100 dark:hover:bg-[#383a3f] transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Add members button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="mx-3 mt-3 mb-1 flex items-center gap-2 px-3 py-2 text-sm text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
      >
        <div className="w-8 h-8 rounded-full border-2 border-dashed border-blue-400/50 flex items-center justify-center">
          <UserPlusIcon className="w-4 h-4" />
        </div>
        <span className="font-medium">Add People</span>
      </button>

      {/* Member list */}
      <div className="flex-1 overflow-y-auto">

      {/* Add Members Modal */}
      {showAddModal && (
        <AddMembersModal
          channelId={channelId}
          channelName={channelName}
          existingMemberIds={members.map((m) => m.user_id)}
          onClose={() => setShowAddModal(false)}
          onMemberAdded={() => onMembersChanged()}
        />
      )}
        {/* Online section */}
        {onlineMembers.length > 0 && (
          <div>
            <div className="px-4 py-2 text-[11px] font-semibold text-neutral-400 dark:text-gray-500 uppercase tracking-wider">
              Online — {onlineMembers.length}
            </div>
            {onlineMembers.map((m) => (
              <MemberRow key={m.user_id} member={m} />
            ))}
          </div>
        )}

        {/* Offline section */}
        {offlineMembers.length > 0 && (
          <div>
            <div className="px-4 py-2 text-[11px] font-semibold text-neutral-400 dark:text-gray-500 uppercase tracking-wider">
              Offline — {offlineMembers.length}
            </div>
            {offlineMembers.map((m) => (
              <MemberRow key={m.user_id} member={m} />
            ))}
          </div>
        )}

        {members.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-neutral-400 dark:text-gray-500">
            <UserGroupIcon className="w-8 h-8 mb-2 text-neutral-300 dark:text-gray-600" />
            <p className="text-sm">No members</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MemberRow({ member }: { member: MemberInfo }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 hover:bg-neutral-50 dark:hover:bg-[#222529] transition-colors">
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
          {member.username.charAt(0).toUpperCase()}
        </div>
        {/* Online indicator */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-[#1e2024] ${
            member.is_online ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-600'
          }`}
        />
      </div>

      {/* Name & status */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-neutral-800 dark:text-gray-200 truncate">
            {member.username}
          </span>
          {member.status_emoji && (
            <span className="text-sm" title={member.custom_status || ''}>
              {member.status_emoji}
            </span>
          )}
        </div>
        {member.custom_status && (
          <p className="text-[11px] text-neutral-400 dark:text-gray-500 truncate">
            {member.custom_status}
          </p>
        )}
      </div>
    </div>
  );
}
