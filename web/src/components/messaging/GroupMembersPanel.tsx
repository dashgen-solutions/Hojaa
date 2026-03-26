'use client';

import React, { useState } from 'react';
import { XMarkIcon, UserGroupIcon, UserPlusIcon, PhoneIcon } from '@heroicons/react/24/outline';
import AddMembersModal from './AddMembersModal';

interface MemberInfo {
  user_id: string;
  username: string;
  email: string;
  is_online: boolean;
  custom_status?: string | null;
  status_emoji?: string | null;
  avatar_url?: string | null;
}

interface GroupMembersPanelProps {
  members: MemberInfo[];
  onClose: () => void;
  channelName: string;
  channelId: string;
  onMembersChanged: () => void;
  userStatuses?: Record<string, string>;
}

export default function GroupMembersPanel({
  members, onClose, channelName, channelId, onMembersChanged, userStatuses = {},
}: GroupMembersPanelProps) {
  const [showAddModal, setShowAddModal] = useState(false);

  // Resolve effective status for each member using live WS data if available
  const withStatus = members.map((m) => ({
    ...m,
    effectiveStatus: userStatuses[m.user_id] ?? (m.is_online ? 'online' : 'offline'),
  }));

  const activeMembers = withStatus.filter((m) => m.effectiveStatus === 'online' || m.effectiveStatus === 'in_call');
  const inCallMembers = withStatus.filter((m) => m.effectiveStatus === 'in_call');
  const onlineMembers = withStatus.filter((m) => m.effectiveStatus === 'online');
  const offlineMembers = withStatus.filter((m) => m.effectiveStatus === 'offline');

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
        {showAddModal && (
          <AddMembersModal
            channelId={channelId}
            channelName={channelName}
            existingMemberIds={members.map((m) => m.user_id)}
            onClose={() => setShowAddModal(false)}
            onMemberAdded={() => onMembersChanged()}
          />
        )}

        {/* In a call section */}
        {inCallMembers.length > 0 && (
          <div>
            <div className="px-4 py-2 text-[11px] font-semibold text-orange-500 dark:text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
              <PhoneIcon className="w-3 h-3" />
              In a call — {inCallMembers.length}
            </div>
            {inCallMembers.map((m) => (
              <MemberRow key={m.user_id} member={m} status="in_call" />
            ))}
          </div>
        )}

        {/* Online section */}
        {onlineMembers.length > 0 && (
          <div>
            <div className="px-4 py-2 text-[11px] font-semibold text-neutral-400 dark:text-gray-500 uppercase tracking-wider">
              Online — {onlineMembers.length}
            </div>
            {onlineMembers.map((m) => (
              <MemberRow key={m.user_id} member={m} status="online" />
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
              <MemberRow key={m.user_id} member={m} status="offline" />
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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function MemberRow({ member, status }: { member: MemberInfo & { effectiveStatus: string }; status: string }) {
  const avatarSrc =
    member.avatar_url &&
    (member.avatar_url.startsWith('http') ? member.avatar_url : `${API_BASE}${member.avatar_url}`);

  const dotColor =
    status === 'in_call' ? 'bg-orange-400' :
    status === 'online' ? 'bg-green-500' :
    'bg-gray-400 dark:bg-gray-600';

  return (
    <div className="flex items-center gap-3 px-4 py-2 hover:bg-neutral-50 dark:hover:bg-[#222529] transition-colors">
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt=""
            className="w-8 h-8 rounded-full object-cover border border-neutral-200 dark:border-[#383a3f]"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
            {member.username.charAt(0).toUpperCase()}
          </div>
        )}
        {/* Status dot */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-[#1e2024] flex items-center justify-center ${dotColor}`}
          title={status === 'in_call' ? 'In a call' : status === 'online' ? 'Online' : 'Offline'}
        >
          {status === 'in_call' && <PhoneIcon className="w-1.5 h-1.5 text-white" />}
        </span>
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
          {status === 'in_call' && (
            <span className="text-[10px] text-orange-500 dark:text-orange-400 font-medium whitespace-nowrap">
              · in a call
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
