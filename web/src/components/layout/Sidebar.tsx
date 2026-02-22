"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  ChatBubbleLeftRightIcon,
  FolderIcon,
  ClockIcon,
  PlusIcon,
  PencilSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useState, useEffect } from "react";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Session {
  id: string;
  document_filename: string | null;
  status: string;
  created_at: string;
}

interface SidebarProps {
  currentSessionId?: string | null;
  sessionName?: string | null;
  onSessionNameUpdate?: (newName: string) => void;
}

export default function Sidebar({ currentSessionId, sessionName, onSessionNameUpdate }: SidebarProps) {
  const router = useRouter();
  const { token, isAuthenticated } = useAuth();
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(sessionName || "");
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (token && isAuthenticated) {
      fetchRecentSessions();
    }
  }, [token, isAuthenticated, sessionName]);

  useEffect(() => {
    setEditedName(sessionName || "");
  }, [sessionName]);

  const fetchRecentSessions = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/sessions?limit=5`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRecentSessions(response.data);
    } catch (err) {
      console.error("Failed to fetch recent sessions:", err);
    }
  };

  const handleNewDiscovery = () => {
    localStorage.removeItem("current_session_id");
    localStorage.removeItem("resume_session_status");
    localStorage.setItem("start_new_session", "true");
    window.location.href = "/";
  };

  const handleViewAllSessions = () => {
    router.push("/sessions");
  };

  const handleSessionClick = (sessionId: string, status: string) => {
    localStorage.setItem("current_session_id", sessionId);
    localStorage.setItem("resume_session_status", status);
    window.location.href = "/";
  };

  const handleSaveSessionName = async () => {
    if (!editedName.trim() || !currentSessionId) return;

    try {
      await axios.patch(
        `${API_URL}/api/sessions/${currentSessionId}`,
        { document_filename: editedName.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setIsEditingName(false);

      if (onSessionNameUpdate) {
        onSessionNameUpdate(editedName.trim());
      }

      setTimeout(async () => {
        await fetchRecentSessions();
      }, 100);
    } catch (err) {
      console.error("Failed to update session name:", err);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  };

  return (
    <div
      className={`${
        isCollapsed ? "w-16" : "w-72"
      } bg-white border-r border-neutral-200/60 flex flex-col transition-all duration-300 ease-smooth relative`}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-6 z-10 w-6 h-6 bg-white border border-neutral-200 rounded-full flex items-center justify-center shadow-soft hover:shadow-soft-md hover:border-neutral-300 transition-all duration-200"
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? (
          <ChevronRightIcon className="w-3.5 h-3.5 text-neutral-500" />
        ) : (
          <ChevronLeftIcon className="w-3.5 h-3.5 text-neutral-500" />
        )}
      </button>

      {/* Sidebar Content - Hidden when collapsed */}
      {!isCollapsed && (
        <>
          {/* New Discovery Button */}
          <div className="p-4">
            <button
              onClick={handleNewDiscovery}
              className="w-full bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 font-medium text-sm transition-all shadow-soft-sm hover:shadow-soft"
            >
              <PlusIcon className="w-4 h-4" />
              New Discovery
            </button>
          </div>

          {/* Current Session */}
          {currentSessionId && (
            <div className="px-4 pb-4">
              <div className="bg-primary-50/50 border border-primary-100 rounded-xl p-3">
                <div className="text-[10px] font-semibold text-primary-600/70 uppercase tracking-wider mb-2">
                  Current Session
                </div>
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleSaveSessionName()}
                      className="flex-1 px-2.5 py-1.5 text-sm bg-white border border-primary-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                      placeholder="Session name..."
                      autoFocus
                    />
                    <button
                      onClick={handleSaveSessionName}
                      className="p-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      <CheckIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingName(false);
                        setEditedName(sessionName || "");
                      }}
                      className="p-1.5 bg-neutral-200 text-neutral-600 rounded-lg hover:bg-neutral-300 transition-colors"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between group">
                    <div className="text-sm font-medium text-neutral-800 truncate pr-2">
                      {sessionName || "Untitled Session"}
                    </div>
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-primary-100 rounded-lg transition-all"
                      title="Rename session"
                    >
                      <PencilSquareIcon className="w-4 h-4 text-primary-600" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="divider mx-4" />

          {/* Recent Sessions */}
          {isAuthenticated && (
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="section-title px-2 mb-3">Recent Sessions</div>

              <div className="space-y-1">
                {recentSessions.length > 0 ? (
                  recentSessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => handleSessionClick(session.id, session.status)}
                      className={`w-full px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${
                        session.id === currentSessionId
                          ? "bg-primary-50 border border-primary-200/60"
                          : "hover:bg-neutral-100 border border-transparent"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            session.id === currentSessionId
                              ? "bg-primary-100"
                              : "bg-neutral-100"
                          }`}
                        >
                          <ChatBubbleLeftRightIcon
                            className={`w-4 h-4 ${
                              session.id === currentSessionId
                                ? "text-primary-600"
                                : "text-neutral-500"
                            }`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className={`text-sm font-medium truncate ${
                              session.id === currentSessionId
                                ? "text-primary-900"
                                : "text-neutral-700"
                            }`}
                          >
                            {session.document_filename || "Untitled"}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <ClockIcon className="w-3 h-3 text-neutral-400" />
                            <span className="text-xs text-neutral-500">
                              {formatDate(session.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-2">
                      <FolderIcon className="w-5 h-5 text-neutral-400" />
                    </div>
                    <p className="text-sm text-neutral-500">No sessions yet</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bottom Section */}
          {isAuthenticated && (
            <div className="p-4 border-t border-neutral-200/60">
              <button
                onClick={handleViewAllSessions}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-neutral-600 hover:bg-neutral-100 flex items-center justify-center gap-2 transition-colors"
              >
                <FolderIcon className="w-4 h-4" />
                View All Sessions
              </button>
            </div>
          )}
        </>
      )}

      {/* Collapsed State */}
      {isCollapsed && (
        <div className="flex flex-col items-center py-4 gap-3">
          <button
            onClick={handleNewDiscovery}
            className="p-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl transition-all shadow-soft-sm hover:shadow-soft"
            title="New Discovery"
          >
            <PlusIcon className="w-5 h-5" />
          </button>

          {currentSessionId && (
            <div
              className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center"
              title={sessionName || "Current Session"}
            >
              <ChatBubbleLeftRightIcon className="w-5 h-5 text-primary-600" />
            </div>
          )}

          <div className="w-8 h-px bg-neutral-200 my-1" />

          {isAuthenticated && (
            <button
              onClick={handleViewAllSessions}
              className="p-2.5 hover:bg-neutral-100 rounded-xl transition-colors"
              title="View All Sessions"
            >
              <FolderIcon className="w-5 h-5 text-neutral-500" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
