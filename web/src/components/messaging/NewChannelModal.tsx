"use client";

import { useState, useEffect } from "react";
import { XMarkIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { createChannel, getMessagingUsers, MessagingUser } from "@/lib/api";

interface NewChannelModalProps {
  onClose: () => void;
  onCreated: (channelId: string) => void;
}

export default function NewChannelModal({ onClose, onCreated }: NewChannelModalProps) {
  const [tab, setTab] = useState<"dm" | "group">("dm");
  const [users, setUsers] = useState<MessagingUser[]>([]);
  const [search, setSearch] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const data = await getMessagingUsers();
        setUsers(data);
      } catch (err) {
        console.error("Failed to load users:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadUsers();
  }, []);

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const toggleUser = (userId: string) => {
    if (tab === "dm") {
      setSelectedUsers([userId]);
    } else {
      setSelectedUsers((prev) =>
        prev.includes(userId)
          ? prev.filter((id) => id !== userId)
          : [...prev, userId],
      );
    }
  };

  const handleCreate = async () => {
    if (selectedUsers.length === 0) {
      setError("Please select at least one user");
      return;
    }
    if (tab === "group" && !groupName.trim()) {
      setError("Please enter a group name");
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      const result = await createChannel({
        name: tab === "group" ? groupName.trim() : undefined,
        is_direct: tab === "dm",
        member_ids: selectedUsers,
      });
      onCreated(result.id);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create conversation");
      setIsCreating(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[100] bg-black/30" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-[#1a1d21] rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-[#383a3f] flex-shrink-0">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">New Conversation</h3>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-[#383a3f] transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-neutral-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-neutral-200 dark:border-[#383a3f] flex-shrink-0">
            <button
              onClick={() => { setTab("dm"); setSelectedUsers([]); }}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                tab === "dm"
                  ? "text-neutral-900 dark:text-white border-b-2 border-neutral-900 dark:border-white"
                  : "text-neutral-500 dark:text-gray-500 hover:text-neutral-700 dark:hover:text-gray-300"
              }`}
            >
              Direct Message
            </button>
            <button
              onClick={() => { setTab("group"); setSelectedUsers([]); }}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                tab === "group"
                  ? "text-neutral-900 dark:text-white border-b-2 border-neutral-900 dark:border-white"
                  : "text-neutral-500 dark:text-gray-500 hover:text-neutral-700 dark:hover:text-gray-300"
              }`}
            >
              Group
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Group name input */}
            {tab === "group" && (
              <div className="mb-3">
                <label className="block text-xs font-medium text-neutral-700 dark:text-gray-300 mb-1">Group Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Design Team"
                  className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-[#383a3f] rounded-md bg-white dark:bg-[#222529] text-neutral-900 dark:text-gray-200 focus:outline-none focus:border-neutral-400 dark:focus:border-[#565856] focus:ring-1 focus:ring-neutral-200 dark:focus:ring-[#383a3f]"
                />
              </div>
            )}

            {/* Search */}
            <div className="relative mb-3">
              <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search people..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-neutral-200 dark:border-[#383a3f] rounded-md bg-white dark:bg-[#222529] text-neutral-900 dark:text-gray-200 focus:outline-none focus:border-neutral-400 dark:focus:border-[#565856] focus:ring-1 focus:ring-neutral-200 dark:focus:ring-[#383a3f]"
              />
            </div>

            {/* Selected users chips */}
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {selectedUsers.map((uid) => {
                  const u = users.find((x) => x.id === uid);
                  return (
                    <span
                      key={uid}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 dark:bg-[#383a3f] text-neutral-700 dark:text-gray-300 rounded-full text-xs"
                    >
                      {u?.username || uid}
                      <button
                        onClick={() => toggleUser(uid)}
                        className="hover:text-neutral-900 dark:hover:text-white"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* User list */}
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="text-center text-xs text-neutral-400 py-6">
                {search ? "No matching users" : "No users available"}
              </p>
            ) : (
              <div className="space-y-0.5">
                {filteredUsers.map((u) => {
                  const isSelected = selectedUsers.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleUser(u.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                        isSelected ? "bg-neutral-100 dark:bg-[#222529]" : "hover:bg-neutral-50 dark:hover:bg-[#222529]/50"
                      }`}
                    >
                      <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-[10px] font-semibold">
                          {u.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-neutral-900 dark:text-gray-200 truncate">{u.username}</p>
                        <p className="text-[11px] text-neutral-500 dark:text-gray-500 truncate">{u.email}</p>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-neutral-900 dark:bg-blue-500 flex items-center justify-center flex-shrink-0">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="px-5 py-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-t border-red-100 dark:border-red-500/20">
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="px-5 py-3 border-t border-neutral-200 dark:border-[#383a3f] flex items-center justify-end gap-2 flex-shrink-0">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-neutral-600 dark:text-gray-400 hover:bg-neutral-100 dark:hover:bg-[#383a3f] rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreating || selectedUsers.length === 0}
              className="px-4 py-1.5 text-sm bg-neutral-900 dark:bg-blue-600 text-white rounded-md hover:bg-neutral-800 dark:hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? "Creating..." : tab === "dm" ? "Start Chat" : "Create Group"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
