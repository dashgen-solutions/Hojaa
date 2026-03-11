'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { XMarkIcon, MagnifyingGlassIcon, UserPlusIcon, CheckIcon } from '@heroicons/react/24/outline';
import { listUsers, addChannelMember } from '@/lib/api';

interface AddMembersModalProps {
  channelId: string;
  channelName: string;
  existingMemberIds: string[];
  onClose: () => void;
  onMemberAdded: () => void;
}

interface UserEntry {
  id: string;
  username: string;
  email: string;
}

export default function AddMembersModal({
  channelId,
  channelName,
  existingMemberIds,
  onClose,
  onMemberAdded,
}: AddMembersModalProps) {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Fetch users when search changes
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listUsers(search || undefined);
      const list = Array.isArray(data) ? data : data.users || data.items || [];
      setUsers(list);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const handleAdd = async (userId: string) => {
    if (adding.has(userId) || added.has(userId)) return;
    setAdding((prev) => new Set(prev).add(userId));
    setError(null);
    try {
      await addChannelMember(channelId, userId);
      setAdded((prev) => new Set(prev).add(userId));
      onMemberAdded();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add member';
      setError(msg);
    } finally {
      setAdding((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  // Filter out existing members
  const filteredUsers = users.filter(
    (u) => !existingMemberIds.includes(u.id) && !added.has(u.id),
  );
  const recentlyAdded = users.filter((u) => added.has(u.id));

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1e2024] rounded-xl shadow-2xl w-[420px] max-h-[500px] flex flex-col border border-neutral-200 dark:border-[#383a3f]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-[#383a3f]">
          <div>
            <h2 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <UserPlusIcon className="w-5 h-5 text-blue-400" />
              Add Members
            </h2>
            <p className="text-[11px] text-neutral-400 dark:text-gray-500 mt-0.5">
              Add people to #{channelName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-600 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-neutral-100 dark:hover:bg-[#383a3f] transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-neutral-50 dark:bg-[#222529] border border-neutral-200 dark:border-[#383a3f] rounded-lg text-neutral-800 dark:text-gray-200 placeholder-neutral-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              autoFocus
            />
          </div>
        </div>

        {error && (
          <div className="mx-4 mb-2 px-3 py-1.5 text-xs text-red-400 bg-red-500/10 rounded-md">
            {error}
          </div>
        )}

        {/* Users list */}
        <div className="flex-1 overflow-y-auto px-2 pb-3" style={{ maxHeight: '320px' }}>
          {loading && filteredUsers.length === 0 && (
            <div className="flex items-center justify-center py-8 text-neutral-400 dark:text-gray-500 text-sm">
              Searching...
            </div>
          )}

          {/* Recently added (shown with check) */}
          {recentlyAdded.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {u.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-800 dark:text-gray-200 truncate">{u.username}</p>
                <p className="text-[11px] text-neutral-400 dark:text-gray-500 truncate">{u.email}</p>
              </div>
              <span className="flex items-center gap-1 text-xs text-green-500 font-medium">
                <CheckIcon className="w-4 h-4" /> Added
              </span>
            </div>
          ))}

          {/* Available users */}
          {filteredUsers.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-[#222529] transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {u.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-800 dark:text-gray-200 truncate">{u.username}</p>
                <p className="text-[11px] text-neutral-400 dark:text-gray-500 truncate">{u.email}</p>
              </div>
              <button
                onClick={() => handleAdd(u.id)}
                disabled={adding.has(u.id)}
                className="px-3 py-1 text-xs font-medium rounded-md bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adding.has(u.id) ? (
                  <span className="flex items-center gap-1">
                    <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Adding
                  </span>
                ) : (
                  'Add'
                )}
              </button>
            </div>
          ))}

          {!loading && filteredUsers.length === 0 && recentlyAdded.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-neutral-400 dark:text-gray-500">
              <UserPlusIcon className="w-8 h-8 mb-2 text-neutral-300 dark:text-gray-600" />
              <p className="text-sm">{search ? 'No matching users found' : 'No users available to add'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
