"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/contexts/AuthContext";
import { useViewerMode } from "@/hooks/useViewerMode";
import { useStore } from "@/stores/useStore";
import { deleteSession, getSessionMembers } from "@/lib/api";
import AddSourceButton from "@/components/sources/AddSourceButton";
import SourcesList from "@/components/sources/SourcesList";
import {
  PencilIcon,
  CheckIcon,
  UserPlusIcon,
  TrashIcon,
  EllipsisHorizontalIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

interface Member {
  user_id: string;
  username: string;
  email: string;
  role: string;
}

interface ProjectToolbarProps {
  onInputAdded?: () => void;
  onSelectInput?: () => void;
}

export default function ProjectToolbar({ onInputAdded, onSelectInput }: ProjectToolbarProps) {
  const { projectId, projectName, updateProjectName } = useProject();
  const { isAuthenticated } = useAuth();
  const readOnly = useViewerMode();
  const router = useRouter();
  const { fetchSources } = useStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(projectName);
  const [members, setMembers] = useState<Member[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditValue(projectName);
  }, [projectName]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Fetch members
  useEffect(() => {
    if (!isAuthenticated) return;
    getSessionMembers(projectId)
      .then(setMembers)
      .catch(() => {});
  }, [projectId, isAuthenticated]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSaveName = async () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== projectName) {
      await updateProjectName(trimmed);
    } else {
      setEditValue(projectName);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSaveName();
    if (e.key === "Escape") {
      setEditValue(projectName);
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this project? This cannot be undone.")) return;
    try {
      setIsDeleting(true);
      await deleteSession(projectId);
      router.push("/projects");
    } catch {
      alert("Failed to delete project.");
      setIsDeleting(false);
    }
  };

  // Distinct colors for member avatars
  const avatarColors = [
    "bg-blue-600", "bg-purple-600", "bg-green-600", "bg-amber-600",
    "bg-rose-600", "bg-cyan-600", "bg-indigo-600", "bg-teal-600",
  ];

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-100 flex-shrink-0">
      {/* Left: Project Name */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {isEditing ? (
          <div className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={handleKeyDown}
              className="text-sm font-semibold text-neutral-900 bg-white border border-neutral-300 rounded-md px-2 py-1 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-200 w-64"
            />
            <button
              onClick={handleSaveName}
              className="p-1 rounded hover:bg-neutral-100 transition-colors"
            >
              <CheckIcon className="w-4 h-4 text-neutral-600" />
            </button>
            <button
              onClick={() => { setEditValue(projectName); setIsEditing(false); }}
              className="p-1 rounded hover:bg-neutral-100 transition-colors"
            >
              <XMarkIcon className="w-4 h-4 text-neutral-400" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => !readOnly && setIsEditing(true)}
            className="flex items-center gap-1.5 group min-w-0"
            title={readOnly ? projectName : "Click to rename"}
          >
            <span className="text-sm font-semibold text-neutral-900 truncate">
              {projectName}
            </span>
            {!readOnly && (
              <PencilIcon className="w-3.5 h-3.5 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            )}
          </button>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Member Avatars */}
        {isAuthenticated && members.length > 0 && (
          <div className="flex items-center -space-x-1.5 mr-1">
            {members.slice(0, 4).map((member, i) => (
              <div
                key={member.user_id}
                className={`w-6 h-6 rounded-full ${avatarColors[i % avatarColors.length]} flex items-center justify-center ring-2 ring-white`}
                title={`${member.username} (${member.role})`}
              >
                <span className="text-white text-[9px] font-semibold">
                  {member.username?.charAt(0).toUpperCase()}
                </span>
              </div>
            ))}
            {members.length > 4 && (
              <div className="w-6 h-6 rounded-full bg-neutral-200 flex items-center justify-center ring-2 ring-white">
                <span className="text-neutral-600 text-[9px] font-semibold">
                  +{members.length - 4}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Share / Add Members button */}
        {isAuthenticated && !readOnly && (
          <button
            className="p-1.5 rounded-md hover:bg-neutral-100 transition-colors text-neutral-500 hover:text-neutral-700"
            title="Share project"
            onClick={() => {
              // For now, link to settings or show a share modal
              // This can be expanded to a full share modal later
              alert("Share feature coming soon. Use Admin panel to manage access.");
            }}
          >
            <UserPlusIcon className="w-4 h-4" />
          </button>
        )}

        <div className="w-px h-5 bg-neutral-200" />

        {/* New Input + Inputs List */}
        {!readOnly && (
          <AddSourceButton
            sessionId={projectId}
            onSourceAdded={() => {
              onInputAdded?.();
              fetchSources(projectId);
            }}
          />
        )}
        <SourcesList
          sessionId={projectId}
          onSelectSource={() => onSelectInput?.()}
        />

        {/* More menu (delete, etc.) */}
        {isAuthenticated && !readOnly && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-md hover:bg-neutral-100 transition-colors text-neutral-500 hover:text-neutral-700"
              title="More options"
            >
              <EllipsisHorizontalIcon className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-md shadow-lg border border-neutral-200 py-1 z-50">
                <button
                  onClick={() => { setShowMenu(false); handleDelete(); }}
                  disabled={isDeleting}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <TrashIcon className="w-4 h-4" />
                  {isDeleting ? "Deleting..." : "Delete Project"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
