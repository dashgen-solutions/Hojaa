"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  ClockIcon,
  PlusIcon,
  PencilIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
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
  }, [token, isAuthenticated, sessionName]); // Re-fetch when sessionName changes

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
    
    console.log("🔄 Updating session name:", {
      sessionId: currentSessionId,
      newName: editedName.trim()
    });
    
    try {
      const response = await axios.patch(
        `${API_URL}/api/sessions/${currentSessionId}`,
        { document_filename: editedName.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log("✅ Session name updated successfully:", response.data);
      
      setIsEditingName(false);
      
      // Update parent component state
      if (onSessionNameUpdate) {
        onSessionNameUpdate(editedName.trim());
      }
      
      // Force immediate refresh of recent sessions list
      setTimeout(async () => {
        await fetchRecentSessions();
        console.log("🔄 Recent sessions list refreshed");
      }, 100);
    } catch (err) {
      console.error("❌ Failed to update session name:", err);
      alert("Failed to update session name");
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
    <div className={`${isCollapsed ? 'w-12' : 'w-64'} bg-white border-r border-secondary-200 flex flex-col transition-all duration-300 ease-in-out relative`}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-20 z-10 w-6 h-6 bg-white border border-secondary-200 rounded-full flex items-center justify-center shadow-md hover:shadow-lg hover:bg-primary-50 transition-all duration-200 group"
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? (
          <ChevronRightIcon className="w-4 h-4 text-gray-600 group-hover:text-primary-600" />
        ) : (
          <ChevronLeftIcon className="w-4 h-4 text-gray-600 group-hover:text-primary-600" />
        )}
      </button>

      {/* Sidebar Content - Hidden when collapsed */}
      {!isCollapsed && (
        <>
          {/* New Conversation Button */}
          <div className="p-4 border-b border-secondary-200">
            <button
              onClick={handleNewDiscovery}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium text-sm transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              New Discovery
            </button>
          </div>

          {/* Current Session Name */}
          {currentSessionId && (
            <div className="p-4 border-b border-secondary-200 bg-primary-50">
          <div className="text-xs font-semibold text-secondary-500 uppercase tracking-wider mb-2">
            Current Session
          </div>
          {isEditingName ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSaveSessionName()}
                className="flex-1 px-2 py-1 text-sm border border-primary-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Session name..."
                autoFocus
              />
              <button
                onClick={handleSaveSessionName}
                className="px-2 py-1 bg-primary-600 text-white text-xs rounded hover:bg-primary-700"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between group">
              <div className="text-sm font-medium text-primary-900 truncate">
                {sessionName || "Untitled Session"}
              </div>
              <button
                onClick={() => setIsEditingName(true)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-primary-100 rounded transition-opacity"
                title="Rename session"
              >
                <PencilIcon className="w-4 h-4 text-primary-600" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Recent Conversations */}
      {isAuthenticated && (
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-3">
            <h3 className="text-xs font-semibold text-secondary-500 uppercase tracking-wider px-2">
              Recent Sessions
            </h3>
          </div>

          <div className="space-y-1">
            {recentSessions.length > 0 ? (
              recentSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => handleSessionClick(session.id, session.status)}
                  className={`w-full px-3 py-2.5 rounded-lg text-left transition-colors ${
                    session.id === currentSessionId
                      ? "bg-primary-50 border border-primary-200"
                      : "hover:bg-secondary-50"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <ChatBubbleLeftRightIcon
                      className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                        session.id === currentSessionId ? "text-primary-600" : "text-secondary-400"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm font-medium truncate ${
                          session.id === currentSessionId ? "text-primary-900" : "text-secondary-900"
                        }`}
                      >
                        {session.document_filename || "Untitled Session"}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <ClockIcon className="w-3 h-3 text-secondary-400" />
                        <span className="text-xs text-secondary-500">
                          {formatDate(session.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center py-4 text-sm text-secondary-500">
                No recent sessions
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Section */}
      <div className="p-4 border-t border-secondary-200">
        <button
          onClick={handleViewAllSessions}
          className="w-full px-3 py-2 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50 flex items-center gap-2 transition-colors"
        >
          <DocumentTextIcon className="w-5 h-5" />
          View All Sessions
        </button>
      </div>
      </>
      )}

      {/* Collapsed State - Show minimal icons */}
      {isCollapsed && (
        <div className="flex flex-col items-center py-4 gap-4">
          <button
            onClick={handleNewDiscovery}
            className="p-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
            title="New Discovery"
          >
            <PlusIcon className="w-5 h-5" />
          </button>
          
          {currentSessionId && (
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
              <ChatBubbleLeftRightIcon className="w-5 h-5 text-primary-600" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
