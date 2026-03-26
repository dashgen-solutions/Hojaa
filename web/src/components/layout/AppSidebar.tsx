"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useOptionalProject } from "@/contexts/ProjectContext";
import axios from "axios";
import {
  FolderIcon,
  MagnifyingGlassIcon,
  ViewColumnsIcon,
  ClockIcon,
  DocumentArrowDownIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  PlusIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ArrowRightOnRectangleIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  SunIcon,
  MoonIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { getMessagingUnreadCount, getMyStatus, updateMyStatus } from "@/lib/api";
import HojaaLogo from '@/components/brand/HojaaLogo';
import { useTheme } from "@/contexts/ThemeContext";
import StatusPicker from "@/components/messaging/StatusPicker";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** How many recent projects to show besides the open one (when the open one is not in that set). */
const SIDEBAR_RECENT_COUNT = 2;
/** Fetch enough sessions so the open project is usually included for sidebar logic. */
const SIDEBAR_SESSIONS_FETCH_LIMIT = 40;

// ---------- Sidebar user section with portal-based status picker ----------

interface SidebarUserSectionProps {
  user: { username?: string; avatar_url?: string | null };
  myStatus: { text: string | null; emoji: string | null };
  showStatusPicker: boolean;
  setShowStatusPicker: (v: boolean | ((prev: boolean) => boolean)) => void;
  setMyStatus: (v: { text: string | null; emoji: string | null }) => void;
  logout: () => void;
  itemHoverCls: string;
}

function SidebarUserSection({
  user,
  myStatus,
  showStatusPicker,
  setShowStatusPicker,
  setMyStatus,
  logout,
  itemHoverCls,
}: SidebarUserSectionProps) {
  const [imgError, setImgError] = useState(false);
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);

  const avatarSrc =
    !imgError &&
    user.avatar_url &&
    (user.avatar_url.startsWith("http") ? user.avatar_url : `${API_URL}${user.avatar_url}`);

  const openPicker = () => {
    if (statusBtnRef.current) {
      const r = statusBtnRef.current.getBoundingClientRect();
      // Position to the right of the sidebar, vertically centered on the button
      setPickerPos({ top: r.top, left: r.right + 8 });
    }
    setShowStatusPicker((v) => !v);
  };

  return (
    <div className="mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-700">
      <div className="flex items-center justify-between px-2 py-1 gap-1">
        <Link
          href="/profile"
          className={`flex items-center gap-2 min-w-0 flex-1 rounded px-1 py-0.5 ${itemHoverCls}`}
          title="Profile"
        >
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt=""
              className="w-6 h-6 rounded-full object-cover flex-shrink-0 border border-neutral-200 dark:border-neutral-600"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center flex-shrink-0">
              <UserCircleIcon className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
            </div>
          )}
          <span className="text-[13px] text-neutral-700 dark:text-neutral-300 truncate">{user.username}</span>
        </Link>
        <button
          onClick={logout}
          className={`p-1 ${itemHoverCls} rounded transition-colors flex-shrink-0`}
          title="Sign out"
        >
          <ArrowRightOnRectangleIcon className="w-3.5 h-3.5 text-neutral-500" />
        </button>
      </div>

      {/* Status line */}
      <button
        ref={statusBtnRef}
        type="button"
        onClick={openPicker}
        className={`w-full text-left px-3 pb-1.5 rounded transition-colors ${itemHoverCls}`}
      >
        {(myStatus.text || myStatus.emoji) ? (
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
            {myStatus.emoji && <span className="mr-1">{myStatus.emoji}</span>}
            {myStatus.text}
          </p>
        ) : (
          <p className="text-[11px] text-neutral-400 dark:text-neutral-600 hover:text-neutral-500 dark:hover:text-neutral-500">
            Set a status
          </p>
        )}
      </button>

      {/* Status picker rendered via portal so it floats outside the narrow sidebar */}
      {showStatusPicker && pickerPos && createPortal(
        <div
          style={{ position: 'fixed', top: Math.max(8, pickerPos.top - 340), left: pickerPos.left, zIndex: 9999 }}
        >
          <StatusPicker
            currentStatus={myStatus.text ?? ''}
            currentEmoji={myStatus.emoji ?? ''}
            onSave={async (text, emoji) => {
              await updateMyStatus({ custom_status: text, status_emoji: emoji });
              setMyStatus({ text: text || null, emoji: emoji || null });
              setShowStatusPicker(false);
            }}
            onClose={() => setShowStatusPicker(false)}
          />
        </div>,
        document.body,
      )}
    </div>
  );
}
const PROJECT_COLORS = [
  "bg-blue-600", "bg-purple-600", "bg-emerald-600", "bg-amber-600",
  "bg-rose-600", "bg-cyan-600", "bg-indigo-600", "bg-teal-600",
  "bg-orange-600", "bg-pink-600",
];

function getProjectColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
}

function getProjectInitial(name: string): string {
  return (name || "U").charAt(0).toUpperCase();
}

interface Project {
  id: string;
  document_filename: string | null;
  status: string;
  created_at: string;
}

/**
 * Sidebar: show 2 most recent + the selected project when it’s not in those two.
 * Selected row first when it would otherwise be missing from the top recents.
 */
function getSidebarProjectsForList(projects: Project[], currentId: string | null): Project[] {
  if (!projects.length) return [];
  if (!currentId) return projects.slice(0, SIDEBAR_RECENT_COUNT);

  const topRecent = projects.slice(0, SIDEBAR_RECENT_COUNT);
  const current = projects.find((p) => p.id === currentId);
  const selectedInTop = topRecent.some((p) => p.id === currentId);

  if (selectedInTop && current) {
    const other = topRecent.find((p) => p.id !== currentId);
    return other ? [current, other] : [current];
  }

  if (current) {
    const others = projects.filter((p) => p.id !== currentId).slice(0, SIDEBAR_RECENT_COUNT);
    return [current, ...others];
  }

  return projects.slice(0, SIDEBAR_RECENT_COUNT);
}

interface AppSidebarProps {
  onNavigate?: () => void;
}

// Dark-mode-aware class helpers
const dividerCls = "h-px bg-neutral-200 dark:bg-neutral-700";
const iconCls = "w-4 h-4 text-neutral-600 dark:text-neutral-400";
const iconMutedCls = "w-4 h-4 text-neutral-500 dark:text-neutral-500";
const itemHoverCls = "hover:bg-neutral-100 dark:hover:bg-neutral-800";

function navItemCls(active: boolean) {
  return active
    ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium"
    : `text-neutral-600 dark:text-neutral-400 ${itemHoverCls}`;
}

export default function AppSidebar({ onNavigate }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, isAuthenticated, isOrgAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  /** Loaded when URL project isn’t in the recent list (so we can still show it in the sidebar). */
  const [missingCurrentProject, setMissingCurrentProject] = useState<Project | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [editingSidebarId, setEditingSidebarId] = useState<string | null>(null);
  const [editingSidebarName, setEditingSidebarName] = useState("");
  const [myStatus, setMyStatus] = useState<{ text: string | null; emoji: string | null }>({ text: null, emoji: null });
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  // Extract current project ID from URL
  const projectIdMatch = pathname.match(/\/projects\/([^/]+)/);
  const currentProjectId = projectIdMatch ? projectIdMatch[1] : null;

  // Get active project name from context (stays in sync on rename)
  const activeProject = useOptionalProject();

  const fetchRecentProjects = useCallback(async () => {
    if (!token || !isAuthenticated) return;
    try {
      const response = await axios.get(`${API_URL}/api/sessions?limit=${SIDEBAR_SESSIONS_FETCH_LIMIT}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRecentProjects(response.data);
    } catch (err) {
      console.error("Failed to fetch recent projects:", err);
    }
  }, [token, isAuthenticated]);

  useEffect(() => {
    fetchRecentProjects();
  }, [fetchRecentProjects]);

  // If the open project isn’t in the fetched recents, load it so the sidebar can show it.
  useEffect(() => {
    if (!token || !isAuthenticated || !currentProjectId) {
      setMissingCurrentProject(null);
      return;
    }
    if (recentProjects.some((p) => p.id === currentProjectId)) {
      setMissingCurrentProject(null);
      return;
    }
    let cancelled = false;
    axios
      .get(`${API_URL}/api/sessions/${currentProjectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (cancelled) return;
        const d = res.data;
        setMissingCurrentProject({
          id: String(d.id),
          document_filename: d.document_filename ?? null,
          status: d.status,
          created_at: d.created_at,
        });
      })
      .catch(() => {
        if (!cancelled) setMissingCurrentProject(null);
      });
    return () => {
      cancelled = true;
    };
  }, [currentProjectId, recentProjects, token, isAuthenticated]);

  const projectsForSidebar = useMemo(() => {
    if (!missingCurrentProject) return recentProjects;
    if (recentProjects.some((p) => p.id === missingCurrentProject.id)) return recentProjects;
    return [missingCurrentProject, ...recentProjects];
  }, [recentProjects, missingCurrentProject]);

  const sidebarProjectsDisplay = useMemo(
    () => getSidebarProjectsForList(projectsForSidebar, currentProjectId),
    [projectsForSidebar, currentProjectId],
  );

  // Listen for project rename events from other components
  useEffect(() => {
    const handleRenamed = (e: Event) => {
      const { id, name } = (e as CustomEvent).detail;
      setRecentProjects(prev =>
        prev.map(p => p.id === id ? { ...p, document_filename: name } : p)
      );
      setMissingCurrentProject((prev) =>
        prev && prev.id === id ? { ...prev, document_filename: name } : prev
      );
    };
    window.addEventListener('projectRenamed', handleRenamed);
    return () => window.removeEventListener('projectRenamed', handleRenamed);
  }, []);

  const handleSidebarRename = async (projectId: string) => {
    if (!token || !editingSidebarName.trim()) return;
    try {
      await axios.patch(
        `${API_URL}/api/sessions/${projectId}`,
        { document_filename: editingSidebarName.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRecentProjects(prev =>
        prev.map(p => p.id === projectId ? { ...p, document_filename: editingSidebarName.trim() } : p)
      );
      setMissingCurrentProject((prev) =>
        prev && prev.id === projectId ? { ...prev, document_filename: editingSidebarName.trim() } : prev
      );
      setEditingSidebarId(null);
      window.dispatchEvent(new CustomEvent('projectRenamed', { detail: { id: projectId, name: editingSidebarName.trim() } }));
    } catch (err) {
      console.error("Failed to rename project:", err);
    }
  };

  // Fetch unread message count
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchUnread = () => {
      getMessagingUnreadCount()
        .then((data) => setUnreadMessages(data.total))
        .catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30_000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Fetch own status on mount
  useEffect(() => {
    if (!isAuthenticated) return;
    getMyStatus()
      .then((s) => setMyStatus({ text: s.custom_status || null, emoji: s.status_emoji || null }))
      .catch(() => {});
  }, [isAuthenticated]);

  // Persist collapse state
  useEffect(() => {
    const saved = localStorage.getItem("sidebar_collapsed");
    if (saved === "true") setIsCollapsed(true);
  }, []);

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem("sidebar_collapsed", String(next));
  };

  const handleNewProject = () => {
    router.push("/?new=true");
  };

  const isActive = (path: string) => pathname === path;
  const isProjectPhaseActive = (phase: string) => {
    if (!currentProjectId) return false;
    return pathname === `/projects/${currentProjectId}/${phase}`;
  };

  const getProjectDisplayName = (project: Project): string => {
    if (project.id === currentProjectId && activeProject?.projectName) {
      return activeProject.projectName;
    }
    return project.document_filename || "Untitled";
  };

  // Collapsed state
  if (isCollapsed) {
    return (
      <div
        className="flex flex-col items-center py-3 gap-1 border-r border-neutral-200 dark:border-neutral-700 relative flex-shrink-0 h-full bg-neutral-50 dark:bg-neutral-900 transition-colors"
        style={{ width: "48px" }}
      >
        {/* Logo */}
        <Link href="/projects" className="mb-2">
          <HojaaLogo size={28} showText={false} />
        </Link>

        <div className={`w-6 ${dividerCls} my-1`} />

        {/* New project */}
        <button
          onClick={handleNewProject}
          className="p-2 bg-neutral-900 dark:bg-brand-lime hover:bg-neutral-800 dark:hover:bg-brand-lime-dark text-white dark:text-neutral-900 rounded transition-colors"
          title="New Project"
        >
          <PlusIcon className="w-4 h-4" />
        </button>

        {/* Projects */}
        <Link
          href="/projects"
          className={`p-2 rounded transition-colors ${navItemCls(isActive("/projects"))}`}
          title="All Projects"
        >
          <FolderIcon className={iconCls} />
        </Link>

        {/* Messages */}
        {isAuthenticated && (
          <Link
            href="/messages"
            className={`p-2 rounded transition-colors relative ${navItemCls(isActive("/messages"))}`}
            title="Messages"
          >
            <ChatBubbleLeftRightIcon className={iconCls} />
            {unreadMessages > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full" />
            )}
          </Link>
        )}

        {/* Project phases (if inside a project) */}
        {currentProjectId && (
          <>
            <div className={`w-6 ${dividerCls} my-1`} />
            <div
              className={`w-7 h-7 rounded ${getProjectColor(currentProjectId)} flex items-center justify-center mb-1`}
              title={activeProject?.projectName || "Project"}
            >
              <span className="text-white text-[10px] font-bold">
                {getProjectInitial(activeProject?.projectName || "P")}
              </span>
            </div>
            {(["discovery", "planning", "documents", "audit", "export"] as const).map((phase) => {
              const Icon = {
                discovery: MagnifyingGlassIcon,
                planning: ViewColumnsIcon,
                documents: DocumentTextIcon,
                audit: ClockIcon,
                export: DocumentArrowDownIcon,
              }[phase];
              return (
                <Link
                  key={phase}
                  href={`/projects/${currentProjectId}/${phase}`}
                  className={`p-2 rounded transition-colors ${navItemCls(isProjectPhaseActive(phase))}`}
                  title={phase.charAt(0).toUpperCase() + phase.slice(1)}
                >
                  <Icon className={iconCls} />
                </Link>
              );
            })}
          </>
        )}

        {/* Bottom icons */}
        <div className="mt-auto flex flex-col items-center gap-1">
          <button
            onClick={toggleCollapse}
            className={`p-2 rounded transition-colors ${itemHoverCls}`}
            title="Expand sidebar"
          >
            <ChevronDoubleRightIcon className={iconMutedCls} />
          </button>
          <button
            onClick={toggleTheme}
            className={`p-2 rounded transition-colors ${itemHoverCls}`}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? (
              <MoonIcon className={iconMutedCls} />
            ) : (
              <SunIcon className={iconMutedCls} />
            )}
          </button>
          <Link
            href="/settings"
            className={`p-2 rounded transition-colors ${navItemCls(isActive("/settings"))}`}
            title="Settings"
          >
            <Cog6ToothIcon className={iconMutedCls} />
          </Link>
          {isAuthenticated && (
            <button
              onClick={logout}
              className={`p-2 rounded transition-colors ${itemHoverCls}`}
              title="Sign out"
            >
              <ArrowRightOnRectangleIcon className={iconMutedCls} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Expanded state
  return (
    <div
      className="flex flex-col border-r border-neutral-200 dark:border-neutral-700 relative flex-shrink-0 overflow-hidden h-full min-h-0 bg-neutral-50 dark:bg-neutral-900 transition-colors"
      style={{ width: "220px" }}
    >
      {/* Logo — fixed at top */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2">
        <Link href="/projects" className="flex items-center gap-2 group">
          <HojaaLogo size={28} />
        </Link>
      </div>

      <div className="flex-shrink-0 px-3 pb-2">
        <div className={dividerCls} />
      </div>

      {/* Main nav: single scroll region between logo and footer — avoids overflow-hidden clipping Discovery / PROJECT */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 pb-2 [scrollbar-gutter:stable]">
        <div className="flex flex-col">
          <button
            onClick={() => setProjectsExpanded(!projectsExpanded)}
            className={`flex w-full flex-shrink-0 items-center justify-between rounded px-2 py-1.5 transition-colors ${itemHoverCls}`}
            style={{ borderRadius: "6px" }}
          >
            <div className="flex items-center gap-2">
              <FolderIcon className={iconMutedCls} />
              <span className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Projects</span>
            </div>
            {projectsExpanded ? (
              <ChevronDownIcon className="h-3 w-3 text-neutral-400" />
            ) : (
              <ChevronRightIcon className="h-3 w-3 text-neutral-400" />
            )}
          </button>

          {projectsExpanded && (
            <div className="mt-1 flex flex-col">
              <button
                onClick={handleNewProject}
                className={`ml-2 flex w-full flex-shrink-0 items-center gap-2 rounded px-2 py-1.5 text-[13px] text-neutral-600 dark:text-neutral-400 ${itemHoverCls} transition-colors`}
                style={{ borderRadius: "6px" }}
              >
                <PlusIcon className="h-3.5 w-3.5" />
                <span>New Project</span>
              </button>

              {/* Open project + 2 recents (deduped); full list on /projects */}
              <div className="ml-2 mt-0.5 space-y-0.5 pr-0.5" aria-label="Recent projects">
                {isAuthenticated &&
                  sidebarProjectsDisplay.map((project) => {
                    const displayName = getProjectDisplayName(project);
                    const color = getProjectColor(project.id);

                    if (editingSidebarId === project.id) {
                      return (
                        <div key={project.id} className="flex items-center gap-1 px-2 py-1">
                          <input
                            autoFocus
                            type="text"
                            value={editingSidebarName}
                            onChange={(e) => setEditingSidebarName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSidebarRename(project.id);
                              if (e.key === "Escape") setEditingSidebarId(null);
                            }}
                            className="min-w-0 flex-1 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-[12px] text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                          />
                          <button
                            onClick={() => handleSidebarRename(project.id)}
                            className="rounded p-0.5 text-green-600 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                            title="Save"
                          >
                            <CheckIcon className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setEditingSidebarId(null)}
                            className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                            title="Cancel"
                          >
                            <XMarkIcon className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={project.id}
                        className={`group/sidebar-proj flex w-full items-center gap-2 rounded px-2 py-1.5 text-[13px] transition-colors ${navItemCls(project.id === currentProjectId)}`}
                        style={{ borderRadius: "6px" }}
                      >
                        <Link
                          href={`/projects/${project.id}/discovery`}
                          className="flex min-w-0 flex-1 items-center gap-2"
                        >
                          <div className={`h-5 w-5 flex-shrink-0 rounded ${color} flex items-center justify-center`}>
                            <span className="text-[10px] font-bold text-white">{getProjectInitial(displayName)}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate">{displayName}</div>
                          </div>
                        </Link>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingSidebarId(project.id);
                            setEditingSidebarName(displayName);
                          }}
                          className="flex-shrink-0 rounded p-0.5 text-neutral-400 opacity-0 transition-opacity hover:bg-neutral-200 group-hover/sidebar-proj:opacity-100 dark:hover:bg-neutral-700"
                          title="Rename"
                        >
                          <PencilIcon className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}

                {isAuthenticated && (
                  <Link
                    href="/projects"
                    className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-[12px] font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 ${itemHoverCls}`}
                    style={{ borderRadius: "6px" }}
                    title="See all projects and open another"
                  >
                    <span className="min-w-0 truncate text-left">View all projects</span>
                    <span className="flex-shrink-0 opacity-80" aria-hidden>
                      &rarr;
                    </span>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Messages — always directly under projects block */}
        {isAuthenticated && (
          <div className="mt-1 flex-shrink-0">
            <Link
              href="/messages"
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-[13px] transition-colors ${navItemCls(isActive("/messages"))}`}
              style={{ borderRadius: "6px", minHeight: "30px" }}
            >
              <ChatBubbleLeftRightIcon className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1">Messages</span>
              {unreadMessages > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </span>
              )}
            </Link>
          </div>
        )}

        {/* Project phase tabs — fixed list (no internal scroll); stays below messages */}
        {currentProjectId ? (
          <div className="mt-3 flex-shrink-0 border-t border-neutral-200 pt-2 dark:border-neutral-700">
            <div
              className="section-title mb-1.5 px-2 text-neutral-500 dark:text-neutral-400 uppercase tracking-wider"
              style={{ fontSize: "10px" }}
            >
              Project
            </div>
            <nav className="space-y-0.5" aria-label="Project sections">
              {(
                [
                  { phase: "discovery", label: "Discovery", Icon: MagnifyingGlassIcon },
                  { phase: "planning", label: "Planning", Icon: ViewColumnsIcon },
                  { phase: "documents", label: "Documents", Icon: DocumentTextIcon },
                  { phase: "audit", label: "Audit", Icon: ClockIcon },
                  { phase: "export", label: "Export", Icon: DocumentArrowDownIcon },
                ] as const
              ).map(({ phase, label, Icon }) => (
                <Link
                  key={phase}
                  href={`/projects/${currentProjectId}/${phase}`}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-[13px] transition-colors ${navItemCls(isProjectPhaseActive(phase))}`}
                  style={{ borderRadius: "6px", minHeight: "30px" }}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        ) : null}
      </div>

      {/* Bottom Section */}
      <div className="flex-shrink-0 px-3 pb-3">
        <div className={`${dividerCls} mb-2`} />

        <div className="space-y-0.5">
          <button
            onClick={toggleCollapse}
            className={`w-full flex items-center gap-2 px-2 py-1.5 text-[13px] rounded transition-colors text-neutral-600 dark:text-neutral-400 ${itemHoverCls}`}
            style={{ borderRadius: "6px", minHeight: "30px" }}
          >
            <ChevronDoubleLeftIcon className="w-4 h-4 flex-shrink-0" />
            Collapse
          </button>
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center gap-2 px-2 py-1.5 text-[13px] rounded transition-colors text-neutral-600 dark:text-neutral-400 ${itemHoverCls}`}
            style={{ borderRadius: "6px", minHeight: "30px" }}
          >
            {theme === 'light' ? (
              <MoonIcon className="w-4 h-4 flex-shrink-0" />
            ) : (
              <SunIcon className="w-4 h-4 flex-shrink-0" />
            )}
            {theme === 'light' ? 'Dark mode' : 'Light mode'}
          </button>
          <Link
            href="/settings"
            className={`w-full flex items-center gap-2 px-2 py-1.5 text-[13px] rounded transition-colors block ${navItemCls(isActive("/settings"))}`}
            style={{ borderRadius: "6px", minHeight: "30px" }}
          >
            <Cog6ToothIcon className="w-4 h-4 flex-shrink-0" />
            Settings
          </Link>

          {isAuthenticated && isOrgAdmin && (
            <Link
              href="/admin"
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-[13px] rounded transition-colors block ${navItemCls(isActive("/admin"))}`}
              style={{ borderRadius: "6px", minHeight: "30px" }}
            >
              <ShieldCheckIcon className="w-4 h-4 flex-shrink-0" />
              Admin
            </Link>
          )}
        </div>

        {/* User section — profile + sign out */}
        {isAuthenticated && user && (
          <SidebarUserSection
            user={user}
            myStatus={myStatus}
            showStatusPicker={showStatusPicker}
            setShowStatusPicker={setShowStatusPicker}
            setMyStatus={setMyStatus}
            logout={logout}
            itemHoverCls={itemHoverCls}
          />
        )}

        {!isAuthenticated && (
          <div className="mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-700 space-y-1">
            <Link
              href="/login"
              className={`block w-full text-center text-[13px] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 px-2 py-1.5 rounded ${itemHoverCls} transition-colors`}
              style={{ borderRadius: "6px" }}
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="block w-full text-center text-[13px] bg-neutral-900 dark:bg-brand-lime text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-brand-lime-dark px-2 py-1.5 rounded font-medium transition-colors"
              style={{ borderRadius: "6px" }}
            >
              Get Started
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
