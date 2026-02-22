"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
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
  ChevronLeftIcon,
  ChevronDownIcon,
  ArrowRightOnRectangleIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";
import { getMessagingUnreadCount } from "@/lib/api";

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

export default function AppSidebar({ onNavigate }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, isAuthenticated, isOrgAdmin, logout } = useAuth();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Extract current project ID from URL
  const projectIdMatch = pathname.match(/\/projects\/([^/]+)/);
  const currentProjectId = projectIdMatch ? projectIdMatch[1] : null;

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

  // Fetch unread message count
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchUnread = () => {
      getMessagingUnreadCount()
        .then((data) => setUnreadMessages(data.total))
        .catch(() => {});
    };
    fetchUnread();
    // Poll every 30 seconds
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Collapsed state
  if (isCollapsed) {
    return (
      <div
        className="flex flex-col items-center py-3 gap-1 border-r border-neutral-200 relative flex-shrink-0 h-full"
        style={{ width: "48px", backgroundColor: "#f8f8f8" }}
      >
        {/* Logo */}
        <Link href="/projects" className="w-8 h-8 bg-neutral-900 rounded flex items-center justify-center mb-2">
          <span className="text-white font-bold text-sm">M</span>
        </Link>

        <div className="w-6 h-px bg-neutral-200 my-1" />

        {/* New project */}
        <button
          onClick={handleNewProject}
          className="p-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded transition-colors"
          title="New Project"
        >
          <PlusIcon className="w-4 h-4" />
        </button>

        {/* Projects */}
        <Link
          href="/projects"
          className={`p-2 rounded transition-colors ${
            isActive("/projects") ? "bg-neutral-200" : "hover:bg-neutral-100"
          }`}
          title="All Projects"
        >
          <FolderIcon className="w-4 h-4 text-neutral-600" />
        </Link>

        {/* Messages */}
        {isAuthenticated && (
          <Link
            href="/messages"
            className={`p-2 rounded transition-colors relative ${
              isActive("/messages") ? "bg-neutral-200" : "hover:bg-neutral-100"
            }`}
            title="Messages"
          >
            <ChatBubbleLeftRightIcon className="w-4 h-4 text-neutral-600" />
            {unreadMessages > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full" />
            )}
          </Link>
        )}

        {/* Project phases (if inside a project) */}
        {currentProjectId && (
          <>
            <div className="w-6 h-px bg-neutral-200 my-1" />
            <Link
              href={`/projects/${currentProjectId}/discovery`}
              className={`p-2 rounded transition-colors ${
                isProjectPhaseActive("discovery") ? "bg-neutral-200" : "hover:bg-neutral-100"
              }`}
              title="Discovery"
            >
              <MagnifyingGlassIcon className="w-4 h-4 text-neutral-600" />
            </Link>
            <Link
              href={`/projects/${currentProjectId}/planning`}
              className={`p-2 rounded transition-colors ${
                isProjectPhaseActive("planning") ? "bg-neutral-200" : "hover:bg-neutral-100"
              }`}
              title="Planning"
            >
              <ViewColumnsIcon className="w-4 h-4 text-neutral-600" />
            </Link>
            <Link
              href={`/projects/${currentProjectId}/audit`}
              className={`p-2 rounded transition-colors ${
                isProjectPhaseActive("audit") ? "bg-neutral-200" : "hover:bg-neutral-100"
              }`}
              title="Audit"
            >
              <ClockIcon className="w-4 h-4 text-neutral-600" />
            </Link>
            <Link
              href={`/projects/${currentProjectId}/export`}
              className={`p-2 rounded transition-colors ${
                isProjectPhaseActive("export") ? "bg-neutral-200" : "hover:bg-neutral-100"
              }`}
              title="Export"
            >
              <DocumentArrowDownIcon className="w-4 h-4 text-neutral-600" />
            </Link>
          </>
        )}

        {/* Bottom icons */}
        <div className="mt-auto flex flex-col items-center gap-1">
          <button
            onClick={toggleCollapse}
            className="p-2 rounded transition-colors hover:bg-neutral-100"
            title="Expand sidebar"
          >
            <ChevronDoubleRightIcon className="w-4 h-4 text-neutral-500" />
          </button>
          <Link
            href="/settings"
            className={`p-2 rounded transition-colors ${
              isActive("/settings") ? "bg-neutral-200" : "hover:bg-neutral-100"
            }`}
            title="Settings"
          >
            <Cog6ToothIcon className="w-4 h-4 text-neutral-500" />
          </Link>
          {isAuthenticated && (
            <button
              onClick={logout}
              className="p-2 hover:bg-neutral-100 rounded transition-colors"
              title="Sign out"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4 text-neutral-500" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Expanded state
  return (
    <div
      className="flex flex-col border-r border-neutral-200 relative flex-shrink-0 overflow-hidden h-full"
      style={{ width: "220px", backgroundColor: "#f8f8f8" }}
    >
      {/* Logo */}
      <div className="px-3 pt-3 pb-2">
        <Link href="/projects" className="flex items-center gap-2 group">
          <div className="w-7 h-7 bg-neutral-900 rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <span className="text-[15px] font-semibold text-neutral-900">MoMetric</span>
        </Link>
      </div>

      <div className="px-3 pb-2">
        <div className="h-px bg-neutral-200" />
      </div>

      {/* Projects Section */}
      <div className="px-3">
        <button
          onClick={() => setProjectsExpanded(!projectsExpanded)}
          className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-neutral-100 transition-colors"
          style={{ borderRadius: "6px" }}
        >
          <div className="flex items-center gap-2">
            <FolderIcon className="w-4 h-4 text-neutral-500" />
            <span className="text-[13px] font-medium text-neutral-700">Projects</span>
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
              className="w-full flex items-center gap-2 px-2 py-1.5 text-[13px] text-neutral-600 hover:bg-neutral-100 rounded transition-colors"
              style={{ borderRadius: "6px" }}
            >
              <PlusIcon className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>

            {/* Recent projects */}
            {isAuthenticated && recentProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}/discovery`}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-[13px] rounded transition-colors block ${
                  project.id === currentProjectId
                    ? "bg-neutral-200 text-neutral-900 font-medium"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
                style={{ borderRadius: "6px" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="truncate">{project.document_filename || "Untitled"}</div>
                  <div className="text-[11px] text-neutral-400">{formatDate(project.created_at)}</div>
                </div>
              </Link>
            ))}

            {/* View All */}
            {isAuthenticated && (
              <Link
                href="/projects"
                className="w-full flex items-center gap-2 px-2 py-1.5 text-[12px] text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded transition-colors"
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
            className={`w-full flex items-center gap-2 px-2 py-1.5 text-[13px] rounded transition-colors ${
              isActive("/messages")
                ? "bg-neutral-200 text-neutral-900 font-medium"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
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
          <div className="h-px bg-neutral-200 mb-2" />
          <div className="section-title px-2 mb-1.5" style={{ fontSize: "10px" }}>
            Project
          </div>

          <div className="space-y-0.5">
            <Link
              href={`/projects/${currentProjectId}/discovery`}
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-[13px] rounded transition-colors block ${
                isProjectPhaseActive("discovery")
                  ? "bg-neutral-200 text-neutral-900 font-medium"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
              style={{ borderRadius: "6px", minHeight: "30px" }}
            >
              <MagnifyingGlassIcon className="w-4 h-4 flex-shrink-0" />
              Discovery
            </Link>
            <Link
              href={`/projects/${currentProjectId}/planning`}
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-[13px] rounded transition-colors block ${
                isProjectPhaseActive("planning")
                  ? "bg-neutral-200 text-neutral-900 font-medium"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
              style={{ borderRadius: "6px", minHeight: "30px" }}
            >
              <ViewColumnsIcon className="w-4 h-4 flex-shrink-0" />
              Planning
            </Link>
            <Link
              href={`/projects/${currentProjectId}/audit`}
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-[13px] rounded transition-colors block ${
                isProjectPhaseActive("audit")
                  ? "bg-neutral-200 text-neutral-900 font-medium"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
              style={{ borderRadius: "6px", minHeight: "30px" }}
            >
              <ClockIcon className="w-4 h-4 flex-shrink-0" />
              Audit
            </Link>
            <Link
              href={`/projects/${currentProjectId}/export`}
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-[13px] rounded transition-colors block ${
                isProjectPhaseActive("export")
                  ? "bg-neutral-200 text-neutral-900 font-medium"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
              style={{ borderRadius: "6px", minHeight: "30px" }}
            >
              <DocumentArrowDownIcon className="w-4 h-4 flex-shrink-0" />
              Export
            </Link>
          </div>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom Section */}
      <div className="px-3 pb-3">
        <div className="h-px bg-neutral-200 mb-2" />

        <div className="space-y-0.5">
          <button
            onClick={toggleCollapse}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-[13px] rounded transition-colors text-neutral-600 hover:bg-neutral-100"
            style={{ borderRadius: "6px", minHeight: "30px" }}
          >
            <ChevronDoubleLeftIcon className="w-4 h-4 flex-shrink-0" />
            Collapse
          </button>
          <Link
            href="/settings"
            className={`w-full flex items-center gap-2 px-2 py-1.5 text-[13px] rounded transition-colors block ${
              isActive("/settings")
                ? "bg-neutral-200 text-neutral-900 font-medium"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
            style={{ borderRadius: "6px", minHeight: "30px" }}
          >
            <Cog6ToothIcon className="w-4 h-4 flex-shrink-0" />
            Settings
          </Link>

          {isAuthenticated && isOrgAdmin && (
            <Link
              href="/admin"
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-[13px] rounded transition-colors block ${
                isActive("/admin")
                  ? "bg-neutral-200 text-neutral-900 font-medium"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
              style={{ borderRadius: "6px", minHeight: "30px" }}
            >
              <ShieldCheckIcon className="w-4 h-4 flex-shrink-0" />
              Admin
            </Link>
          )}
        </div>

        {/* User section */}
        {isAuthenticated && user && (
          <div className="mt-2 pt-2 border-t border-neutral-200">
            <div className="flex items-center justify-between px-2 py-1">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-neutral-900 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[10px] font-semibold">
                    {user.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-[13px] text-neutral-700 truncate">{user.username}</span>
              </div>
              <button
                onClick={logout}
                className="p-1 hover:bg-neutral-100 rounded transition-colors flex-shrink-0"
                title="Sign out"
              >
                <ArrowRightOnRectangleIcon className="w-3.5 h-3.5 text-neutral-500" />
              </button>
            </div>
          </div>
        )}

        {!isAuthenticated && (
          <div className="mt-2 pt-2 border-t border-neutral-200 space-y-1">
            <Link
              href="/login"
              className="block w-full text-center text-[13px] text-neutral-600 hover:text-neutral-900 px-2 py-1.5 rounded hover:bg-neutral-100 transition-colors"
              style={{ borderRadius: "6px" }}
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="block w-full text-center text-[13px] bg-neutral-900 text-white hover:bg-neutral-800 px-2 py-1.5 rounded font-medium transition-colors"
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
