"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/contexts/ProjectContext";
import { useViewerMode } from "@/hooks/useViewerMode";
import AuditTimeline from "@/components/audit/AuditTimeline";
import BulkNodeActions from "@/components/audit/BulkNodeActions";
import TimeTravelView from "@/components/audit/TimeTravelView";
import NotificationSettings from "@/components/audit/NotificationSettings";

export default function AuditPage() {
  const { projectId, isLoading } = useProject();
  const readOnly = useViewerMode();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"timeline" | "nodes" | "timetravel" | "notifications">("timeline");

  useEffect(() => {
    if (readOnly) {
      router.replace(`/projects/${projectId}/discovery`);
    }
  }, [readOnly, router, projectId]);

  if (readOnly) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-neutral-50">
        <div className="w-8 h-8 border-3 border-neutral-200 border-t-neutral-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="px-6 pt-4 flex-shrink-0">
        <div className="flex gap-1 bg-neutral-200/60 rounded-md p-0.5 w-fit">
          {(["timeline", "nodes", "timetravel", "notifications"] as const).map((tab) => {
            const labels = {
              timeline: "Change History",
              nodes: "Manage Nodes",
              timetravel: "Time Travel",
              notifications: "Notifications",
            };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-600 hover:text-neutral-800"
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {activeTab === "timeline" && <AuditTimeline sessionId={projectId} />}
        {activeTab === "nodes" && <BulkNodeActions sessionId={projectId} />}
        {activeTab === "timetravel" && <TimeTravelView sessionId={projectId} />}
        {activeTab === "notifications" && <NotificationSettings sessionId={projectId} />}
      </div>
    </div>
  );
}
