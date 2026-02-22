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
  BuildingOffice2Icon,
  ShareIcon,
} from "@heroicons/react/24/outline";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Session {
  id: string;
  user_id: string | null;
  status: string;
  document_filename: string | null;
  created_at: string;
  updated_at: string;
}

export default function SessionsPage() {
  const { user, token, isLoading: authLoading, isAuthenticated, logout } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    // If not authenticated, redirect to login
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    const fetchSessions = async () => {
      if (!token) return;

      try {
        setIsLoading(true);
        const response = await axios.get(`${API_URL}/api/sessions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSessions(response.data);
      } catch (err: any) {
        console.error("Failed to fetch sessions:", err);
        setError("Failed to load sessions. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchSessions();
    }
  }, [token]);

  const handleCreateNewSession = () => {
    console.log("=== NEW SESSION CLICKED ===");
    // Clear any existing session and set flag to create new one
    localStorage.removeItem("current_session_id");
    localStorage.removeItem("resume_session_status");
    localStorage.setItem("start_new_session", "true");
    
    console.log("LocalStorage cleared, navigating to /");
    // Use window.location for full page reload to reset React state
    window.location.href = "/";
  };

  const handleResumeSession = async (sessionId: string) => {
    try {
      console.log("=== RESUME CLICKED ===");
      console.log("Session ID:", sessionId);
      console.log("Token exists:", !!token);
      
      // Fetch the session details to determine which step to resume at
      const response = await axios.get(`${API_URL}/api/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const session = response.data;
      
      console.log("Session fetched successfully:", session);
      console.log("Session status:", session.status);
      
      // Clear any previous session data first
      localStorage.removeItem("current_session_id");
      localStorage.removeItem("resume_session_status");
      localStorage.removeItem("start_new_session");
      
      // Store session ID and its status for resumption
      localStorage.setItem("current_session_id", sessionId);
      localStorage.setItem("resume_session_status", session.status);
      
      console.log("LocalStorage set:");
      console.log("- current_session_id:", localStorage.getItem("current_session_id"));
      console.log("- resume_session_status:", localStorage.getItem("resume_session_status"));
      
      // Navigate to main page
      console.log("Navigating to /");
      window.location.href = "/"; // Use window.location instead of router.push for a full reload
    } catch (err: any) {
      console.error("=== RESUME FAILED ===");
      console.error("Error:", err);
      console.error("Response:", err.response?.data);
      alert(`Failed to resume session: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!token) return;

    if (!confirm("Are you sure you want to delete this session? This action cannot be undone.")) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/api/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Remove from list
      setSessions(sessions.filter((s) => s.id !== sessionId));
    } catch (err: any) {
      console.error("Failed to delete session:", err);
      alert("Failed to delete session. Please try again.");
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
      upload_pending: "bg-yellow-100 text-yellow-800",
      questions_pending: "bg-blue-100 text-blue-800",
      in_progress: "bg-purple-100 text-purple-800",
      completed: "bg-green-100 text-green-800",
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
          statusColors[status] || "bg-gray-100 text-gray-800"
        }`}
      >
        {statusLabels[status] || status}
      </span>
    );
  };

  const isViewer = user?.role === "viewer";

  if (authLoading || (isAuthenticated && isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-900 mx-auto"></div>
          <p className="mt-4 text-secondary-600">Loading your sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-secondary-50">
      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-secondary-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-neutral-900 rounded-md flex items-center justify-center">
                  <span className="text-white font-bold text-lg">M</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-secondary-900">
                    My Sessions
                  </h1>
                  <p className="text-sm text-secondary-600">
                    Welcome back, {user?.username}!
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isViewer && (
                <button
                  onClick={handleCreateNewSession}
                  className="flex items-center gap-2 bg-neutral-900 text-white px-4 py-2 rounded-md hover:bg-neutral-800 transition-colors"
                >
                  <PlusIcon className="w-5 h-5" />
                  <span>New Session</span>
                </button>
              )}
              {user?.organization?.name && (
                <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-neutral-500 bg-neutral-100 px-3 py-1.5 rounded-full">
                  <BuildingOffice2Icon className="w-3.5 h-3.5" />
                  {user.organization.name}
                </span>
              )}
              <button
                onClick={logout}
                className="px-4 py-2 text-secondary-600 hover:text-secondary-900 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          {sessions.length === 0 ? (
            <div className="bg-white rounded-md shadow-sm p-12 text-center">
              <DocumentTextIcon className="w-16 h-16 text-secondary-300 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-secondary-900 mb-2">
                No Sessions Yet
              </h2>
              <p className="text-secondary-600 mb-6">
                Start your first requirements discovery session to get started!
              </p>
              <button
                onClick={handleCreateNewSession}
                className="inline-flex items-center gap-2 bg-neutral-900 text-white px-6 py-3 rounded-md hover:bg-neutral-800 transition-colors"
              >
                <PlusIcon className="w-5 h-5" />
                <span>Create Your First Session</span>
              </button>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sessions.map((session) => {
                const isOwned = session.user_id === user?.id;
                const isShared = !isOwned;

                return (
                <div
                  key={session.id}
                  className="bg-white rounded-md shadow-sm border border-secondary-200 p-6 hover:shadow transition-shadow flex flex-col"
                >
                  <div className="flex items-start justify-between mb-4">
                    <DocumentTextIcon className="w-8 h-8 text-neutral-900 flex-shrink-0" />
                    <div className="flex items-center gap-2">
                      {isShared && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-200">
                          <ShareIcon className="w-3 h-3" />
                          Shared
                        </span>
                      )}
                      {getStatusBadge(session.status)}
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-secondary-900 mb-2 line-clamp-2">
                    {session.document_filename || "Untitled Session"}
                  </h3>

                  <div className="flex items-center gap-2 text-sm text-secondary-600 mb-4">
                    <ClockIcon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{formatDate(session.created_at)}</span>
                  </div>

                  <div className="flex gap-2 mt-auto">
                    <button
                      onClick={() => handleResumeSession(session.id)}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors ${
                        isViewer || (isShared && !isOwned)
                          ? "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                          : "bg-neutral-900 text-white hover:bg-neutral-800"
                      }`}
                    >
                      {isViewer ? (
                        <>
                          <EyeIcon className="w-4 h-4" />
                          <span>View</span>
                        </>
                      ) : (
                        <>
                          <span>Resume</span>
                          <ArrowRightIcon className="w-4 h-4" />
                        </>
                      )}
                    </button>
                    {isOwned && !isViewer && (
                      <button
                        onClick={() => handleDeleteSession(session.id)}
                        className="flex items-center justify-center p-2 border border-red-200 text-red-600 rounded-md hover:bg-red-50 transition-colors"
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
    </div>
  );
}
