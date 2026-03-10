"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "@heroicons/react/24/outline";
import { getMessagingUnreadCount } from "@/lib/api";
import HojaaLogo from '@/components/brand/HojaaLogo';
import { useTheme } from "@/contexts/ThemeContext";

// Generate a consistent color from a string (project id/name)
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Project {
  id: string;
  document_filename: string | null;
  status: string;
  created_at: string;
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
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [editingSidebarId, setEditingSidebarId] = useState<string | null>(null);
  const [editingSidebarName, setEditingSidebarName] = useState("");

  // Extract current project ID from URL
  const projectIdMatch = pathname.match(/\/projects\/([^/]+)/);
  const currentProjectId = projectIdMatch ? projectIdMatch[1] : null;

  // Get active project name from context (stays in sync on rename)
  const activeProject = useOptionalProject();

  const fetchRecentProjects = useCallback(async () => {
    if (!token || !isAuthenticated) return;
    try {
      const response = await axios.get(`${API_URL}/api/sessions?limit=5`, {
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

  // Listen for project rename events from other components
  useEffect(() => {
    const handleRenamed = (e: Event) => {
      const { id, name } = (e as CustomEvent).detail;
      setRecentProjects(prev =>
        prev.map(p => p.id === id ? { ...p, document_filename: name } : p)
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
      className="flex flex-col border-r border-neutral-200 dark:border-neutral-700 relative flex-shrink-0 overflow-hidden h-full bg-neutral-50 dark:bg-neutral-900 transition-colors"
      style={{ width: "220px" }}
    >
      {/* Logo */}
      <div className="px-3 pt-3 pb-2">
        <Link href="/projects" className="flex items-center gap-2 group">
          <HojaaLogo size={28} />
        </Link>
      </div>

      <div className="px-3 pb-2">
        <div className={dividerCls} />
      </div>

      {/* Projects Section */}
      <div className="px-3">
        <button
          onClick={() => setProjectsExpanded(!projectsExpanded)}
          className={`w-full flex items-center justify-between px-2 py-1.5 rounded transition-colors ${itemHoverCls}`}
          style={{ borderRadius: "6px" }}
        >
          <div className="flex items-center gap-2">
            <FolderIcon className={iconMutedCls} />
            <span className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Projects</span>
          </div>
          {projectsExpanded ? (
            <ChevronDownIcon className="w-3 h-3 text-neutral-400" />
          ) : (
            <ChevronRightIcon className="w-3 h-3 text-neutral-400" />
          )}
        </button>

        {projectsExpanded && (
          <div className="mt-1 ml-2 space-y-0.5">
            {/* New Project button */}
            <button
              onClick={handleNewProject}
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-[13px] text-neutral-600 dark:text-neutral-400 ${itemHoverCls} rounded transition-colors`}
              style={{ borderRadius: "6px" }}
            >
              <PlusIcon className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>

            {/* Recent projects */}
            {isAuthenticated && recentProjects.map((project) => {
              const displayName = getProjectDisplayName(project);
              const color = getProjectColor(project.id);

              if (editingSidebarId === project.id) {
                return (
                  <div
                    key={project.id}
                    className="flex items-center gap-1 px-2 py-1"
                  >
                    <input
                      autoFocus
                      type="text"
                      value={editingSidebarName}
                      onChange={(e) => setEditingSidebarName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSidebarRename(project.id);
                        if (e.key === "Escape") setEditingSidebarId(null);
                      }}
                      className="flex-1 min-w-0 text-[12px] bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded px-1.5 py-0.5 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                    />
                    <button onClick={() => handleSidebarRename(project.id)} className="p-0.5 text-green-600 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded" title="Save">
                      <CheckIcon className="w-3 h-3" />
                    </button>
                    <button onClick={() => setEditingSidebarId(null)} className="p-0.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded" title="Cancel">
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={project.id}
                  className={`group/sidebar-proj w-full flex items-center gap-2 px-2 py-1.5 text-[13px] rounded transition-colors ${navItemCls(project.id === currentProjectId)}`}
                  style={{ borderRadius: "6px" }}
                >
                  <Link
                    href={`/projects/${project.id}/discovery`}
                    className="flex items-center gap-2 flex-1 min-w-0"
                  >
                    <div className={`w-5 h-5 rounded ${color} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-white text-[10px] font-bold">{getProjectInitial(displayName)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{displayName}</div>
                    </div>
                  </Link>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingSidebarId(project.id);
                      setEditingSidebarName(displayName);
                    }}
                    className="p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 opacity-0 group-hover/sidebar-proj:opacity-100 transition-opacity flex-shrink-0"
                    title="Rename"
                  >
                    <PencilIcon className="w-3 h-3" />
                  </button>
                </div>
              );
            })}

            {/* View All */}
            {isAuthenticated && (
              <Link
                href="/projects"
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-[12px] text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 ${itemHoverCls} rounded transition-colors`}
                style={{ borderRadius: "6px" }}
              >
                View All &rarr;
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      {isAuthenticated && (
        <div className="px-3 mt-1">
          <Link
            href="/messages"
            className={`w-full flex items-center gap-2 px-2 py-1.5 text-[13px] rounded transition-colors ${navItemCls(isActive("/messages"))}`}
            style={{ borderRadius: "6px", minHeight: "30px" }}
          >
            <ChatBubbleLeftRightIcon className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">Messages</span>
            {unreadMessages > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {unreadMessages > 9 ? "9+" : unreadMessages}
              </span>
            )}
          </Link>
        </div>
      )}

      {/* Project Phases (only when inside a project) */}
      {currentProjectId && (
        <div className="px-3 mt-3">
          <div className={`${dividerCls} mb-2`} />
          <div className="section-title px-2 mb-1.5" style={{ fontSize: "10px" }}>
            Project
          </div>

          <div className="space-y-0.5">
            {([
              { phase: "discovery", label: "Discovery", Icon: MagnifyingGlassIcon },
              { phase: "planning", label: "Planning", Icon: ViewColumnsIcon },
              { phase: "documents", label: "Documents", Icon: DocumentTextIcon },
              { phase: "audit", label: "Audit", Icon: ClockIcon },
              { phase: "export", label: "Export", Icon: DocumentArrowDownIcon },
            ] as const).map(({ phase, label, Icon }) => (
              <Link
                key={phase}
                href={`/projects/${currentProjectId}/${phase}`}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-[13px] rounded transition-colors block ${navItemCls(isProjectPhaseActive(phase))}`}
                style={{ borderRadius: "6px", minHeight: "30px" }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom Section */}
      <div className="px-3 pb-3">
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

        {/* User section */}
        {isAuthenticated && user && (
          <div className="mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center justify-between px-2 py-1">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-neutral-900 dark:bg-neutral-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[10px] font-semibold">
                    {user.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-[13px] text-neutral-700 dark:text-neutral-300 truncate">{user.username}</span>
              </div>
              <button
                onClick={logout}
                className={`p-1 ${itemHoverCls} rounded transition-colors flex-shrink-0`}
                title="Sign out"
              >
                <ArrowRightOnRectangleIcon className="w-3.5 h-3.5 text-neutral-500" />
              </button>
            </div>
          </div>
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
