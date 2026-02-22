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
        isCollapsed ? "w-12" : ""
      } flex flex-col transition-all duration-200 relative border-r border-neutral-200`}
      style={{
        width: isCollapsed ? "48px" : "220px",
        backgroundColor: "#f8f8f8",
      }}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-4 z-10 w-5 h-5 bg-white border border-neutral-200 rounded flex items-center justify-center hover:bg-neutral-50 transition-colors"
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
      >
        {isCollapsed ? (
          <ChevronRightIcon className="w-3 h-3 text-neutral-500" />
        ) : (
          <ChevronLeftIcon className="w-3 h-3 text-neutral-500" />
        )}
      </button>

      {/* Sidebar Content */}
      {!isCollapsed && (
        <>
          {/* New Discovery Button */}
          <div className="p-3">
            <button
              onClick={handleNewDiscovery}
              className="w-full bg-neutral-900 hover:bg-neutral-800 text-white px-3 flex items-center justify-center gap-1.5 font-medium text-[13px] transition-colors"
              style={{ height: "28px", borderRadius: "6px" }}
            >
              <PlusIcon className="w-3.5 h-3.5" />
              New Discovery
            </button>
          </div>

          {/* Current Session */}
          {currentSessionId && (
            <div className="px-3 pb-3">
              <div className="bg-white border border-neutral-200 p-2.5" style={{ borderRadius: "6px" }}>
                <div className="section-title mb-1.5" style={{ fontSize: "10px" }}>
                  Current Session
                </div>
                {isEditingName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleSaveSessionName()}
                      className="flex-1 px-2 text-[13px] bg-white border border-neutral-200 focus:outline-none focus:border-primary-500"
                      style={{ height: "26px", borderRadius: "4px" }}
                      placeholder="Session name..."
                      autoFocus
                    />
                    <button
                      onClick={handleSaveSessionName}
                      className="p-1 bg-neutral-900 text-white rounded hover:bg-neutral-800 transition-colors"
                    >
                      <CheckIcon className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingName(false);
                        setEditedName(sessionName || "");
                      }}
                      className="p-1 bg-neutral-100 text-neutral-600 rounded hover:bg-neutral-200 transition-colors"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between group">
                    <div className="text-[13px] font-medium text-neutral-900 truncate pr-2">
                      {sessionName || "Untitled Session"}
                    </div>
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-neutral-100 rounded transition-all"
                      title="Rename session"
                    >
                      <PencilSquareIcon className="w-3.5 h-3.5 text-neutral-500" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="divider mx-3" />

          {/* Recent Sessions */}
          {isAuthenticated && (
            <div className="flex-1 overflow-y-auto px-3 py-3">
              <div className="section-title px-2 mb-2">Recent Sessions</div>

              <div className="space-y-0.5">
                {recentSessions.length > 0 ? (
                  recentSessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => handleSessionClick(session.id, session.status)}
                      className={`w-full px-2 py-1.5 text-left transition-colors ${
                        session.id === currentSessionId
                          ? "bg-neutral-200 text-neutral-900"
                          : "hover:bg-neutral-100 text-neutral-600"
                      }`}
                      style={{ borderRadius: "6px", height: "auto", minHeight: "30px" }}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            session.id === currentSessionId
                              ? "bg-neutral-300"
                              : "bg-neutral-200"
                          }`}
                        >
                          <ChatBubbleLeftRightIcon
                            className={`w-3.5 h-3.5 ${
                              session.id === currentSessionId
                                ? "text-neutral-700"
                                : "text-neutral-500"
                            }`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className={`text-[13px] truncate ${
                              session.id === currentSessionId
                                ? "font-medium text-neutral-900"
                                : "text-neutral-700"
                            }`}
                          >
                            {session.document_filename || "Untitled"}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <ClockIcon className="w-3 h-3 text-neutral-400" />
                            <span className="text-[11px] text-neutral-500">
                              {formatDate(session.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <div className="w-8 h-8 rounded bg-neutral-200 flex items-center justify-center mx-auto mb-2">
                      <FolderIcon className="w-4 h-4 text-neutral-400" />
                    </div>
                    <p className="text-[12px] text-neutral-500">No sessions yet</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bottom Section */}
          {isAuthenticated && (
            <div className="p-3 border-t border-neutral-200">
              <button
                onClick={handleViewAllSessions}
                className="w-full px-2 py-1.5 text-[13px] text-neutral-600 hover:bg-neutral-100 flex items-center justify-center gap-1.5 transition-colors"
                style={{ borderRadius: "6px" }}
              >
                <FolderIcon className="w-3.5 h-3.5" />
                View All Sessions
              </button>
            </div>
          )}
        </>
      )}

      {/* Collapsed State */}
      {isCollapsed && (
        <div className="flex flex-col items-center py-3 gap-2">
          <button
            onClick={handleNewDiscovery}
            className="p-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded transition-colors"
            title="New Discovery"
          >
            <PlusIcon className="w-4 h-4" />
          </button>

          {currentSessionId && (
            <div
              className="w-8 h-8 rounded bg-neutral-200 flex items-center justify-center"
              title={sessionName || "Current Session"}
            >
              <ChatBubbleLeftRightIcon className="w-4 h-4 text-neutral-600" />
            </div>
          )}

          <div className="w-6 h-px bg-neutral-200 my-0.5" />

          {isAuthenticated && (
            <button
              onClick={handleViewAllSessions}
              className="p-2 hover:bg-neutral-100 rounded transition-colors"
              title="View All Sessions"
            >
              <FolderIcon className="w-4 h-4 text-neutral-500" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
