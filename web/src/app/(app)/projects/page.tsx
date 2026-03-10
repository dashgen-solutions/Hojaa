"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import {
  PlusIcon,
  DocumentTextIcon,
  ClockIcon,
  TrashIcon,
  ArrowRightIcon,
  EyeIcon,
  ShareIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Project {
  id: string;
  user_id: string | null;
  status: string;
  document_filename: string | null;
  created_at: string;
  updated_at: string;
}

export default function ProjectsPage() {
  const { user, token, isLoading: authLoading, isAuthenticated } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    const fetchProjects = async () => {
      if (!token) return;

      try {
        setIsLoading(true);
        const response = await axios.get(`${API_URL}/api/sessions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setProjects(response.data);
      } catch (err: any) {
        console.error("Failed to fetch projects:", err);
        setError("Failed to load projects. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchProjects();
    }
  }, [token]);

  const handleCreateNewProject = () => {
    router.push("/?new=true");
  };

  const handleOpenProject = (projectId: string) => {
    router.push(`/projects/${projectId}/discovery`);
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!token) return;

    if (!confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/api/sessions/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProjects(projects.filter((p) => p.id !== projectId));
    } catch (err: any) {
      console.error("Failed to delete project:", err);
      alert("Failed to delete project. Please try again.");
    }
  };

  const handleRenameProject = async (projectId: string) => {
    if (!token || !editingName.trim()) return;
    try {
      await axios.patch(
        `${API_URL}/api/sessions/${projectId}`,
        { document_filename: editingName.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProjects(projects.map((p) =>
        p.id === projectId ? { ...p, document_filename: editingName.trim() } : p
      ));
      setEditingProjectId(null);
      // Notify sidebar and other components
      window.dispatchEvent(new CustomEvent('projectRenamed', { detail: { id: projectId, name: editingName.trim() } }));
    } catch (err: any) {
      console.error("Failed to rename project:", err);
      alert("Failed to rename project.");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      upload_pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
      questions_pending: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
      in_progress: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
      completed: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    };

    const statusLabels: Record<string, string> = {
      upload_pending: "Upload Pending",
      questions_pending: "Questions Pending",
      in_progress: "In Progress",
      completed: "Completed",
    };

    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-medium ${
          statusColors[status] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
        }`}
      >
        {statusLabels[status] || status}
      </span>
    );
  };

  const isViewer = user?.role === "viewer";

  if (authLoading || (isAuthenticated && isLoading)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-900 dark:border-neutral-100 mx-auto"></div>
          <p className="mt-4 text-neutral-500 dark:text-neutral-400">Loading your projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">My Projects</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              Welcome back, {user?.username}!
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isViewer && (
              <button
                onClick={handleCreateNewProject}
                className="flex items-center gap-2 bg-brand-lime text-brand-dark hover:bg-brand-lime/90 font-medium shadow-sm hover:shadow-[0_0_16px_-4px_rgba(228,255,26,0.4)] px-4 py-2 rounded-md transition-colors text-sm"
              >
                <PlusIcon className="w-4 h-4" />
                New Project
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300 px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {projects.length === 0 ? (
          <div className="bg-white dark:bg-neutral-900 rounded-md shadow-sm p-12 text-center border border-neutral-200 dark:border-neutral-700">
            <DocumentTextIcon className="w-16 h-16 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">No Projects Yet</h2>
            <p className="text-neutral-500 dark:text-neutral-400 mb-6 text-sm">
              Start your first requirements discovery project to get started!
            </p>
            <button
              onClick={handleCreateNewProject}
              className="inline-flex items-center gap-2 bg-brand-lime text-brand-dark hover:bg-brand-lime/90 font-medium shadow-sm hover:shadow-[0_0_16px_-4px_rgba(228,255,26,0.4)] px-6 py-3 rounded-md transition-colors text-sm"
            >
              <PlusIcon className="w-5 h-5" />
              Create Your First Project
            </button>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((project) => {
              const isOwned = project.user_id === user?.id;
              const isShared = !isOwned;

              return (
                <div
                  key={project.id}
                  className="bg-white dark:bg-neutral-900 rounded-md shadow-sm border border-neutral-200 dark:border-neutral-700 p-6 hover:shadow dark:hover:border-neutral-600 transition-shadow flex flex-col"
                >
                  <div className="flex items-start justify-between mb-4">
                    <DocumentTextIcon className="w-8 h-8 text-neutral-900 dark:text-neutral-100 flex-shrink-0" />
                    <div className="flex items-center gap-2">
                      {isShared && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700">
                          <ShareIcon className="w-3 h-3" />
                          Shared
                        </span>
                      )}
                      {getStatusBadge(project.status)}
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2 line-clamp-2">
                    {editingProjectId === project.id ? (
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          autoFocus
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameProject(project.id);
                            if (e.key === "Escape") setEditingProjectId(null);
                          }}
                          className="flex-1 text-base font-semibold text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                        />
                        <button
                          onClick={() => handleRenameProject(project.id)}
                          className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-green-600"
                          title="Save"
                        >
                          <CheckIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingProjectId(null)}
                          className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-400"
                          title="Cancel"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="group/name inline-flex items-center gap-1.5">
                        {project.document_filename || "Untitled Project"}
                        {isOwned && !isViewer && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingProjectId(project.id);
                              setEditingName(project.document_filename || "Untitled Project");
                            }}
                            className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 opacity-0 group-hover/name:opacity-100 transition-opacity"
                            title="Rename project"
                          >
                            <PencilIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </span>
                    )}
                  </h3>

                  <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-4">
                    <ClockIcon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{formatDate(project.created_at)}</span>
                  </div>

                  <div className="flex gap-2 mt-auto">
                    <button
                      onClick={() => handleOpenProject(project.id)}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors text-sm font-medium ${
                        isViewer || (isShared && !isOwned)
                          ? "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                          : "bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                      }`}
                    >
                      {isViewer ? (
                        <>
                          <EyeIcon className="w-4 h-4" />
                          <span>View</span>
                        </>
                      ) : (
                        <>
                          <span>Open</span>
                          <ArrowRightIcon className="w-4 h-4" />
                        </>
                      )}
                    </button>
                    {isOwned && !isViewer && (
                      <button
                        onClick={() => handleDeleteProject(project.id)}
                        className="flex items-center justify-center p-2 border border-red-200 text-red-600 rounded-md hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
