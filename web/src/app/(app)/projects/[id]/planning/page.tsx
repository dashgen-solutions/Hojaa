"use client";

import { useProject } from "@/contexts/ProjectContext";
import { useViewerMode } from "@/hooks/useViewerMode";
import PlanningBoard from "@/components/planning/PlanningBoard";

export default function PlanningPage() {
  const { projectId, isLoading } = useProject();
  const readOnly = useViewerMode();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-neutral-50 dark:bg-[#060606]">
        <div className="w-8 h-8 border-3 border-neutral-200 dark:border-neutral-700 border-t-neutral-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden">
      <PlanningBoard sessionId={projectId} readOnly={readOnly} />
    </div>
  );
}
