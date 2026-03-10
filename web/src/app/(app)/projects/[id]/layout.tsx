"use client";

import { ProjectProvider } from "@/contexts/ProjectContext";
import SessionChatbot from "@/components/chat/SessionChatbot";
import { useParams } from "next/navigation";

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const projectId = params.id as string;

  return (
    <ProjectProvider projectId={projectId}>
      {children}
      <SessionChatbot sessionId={projectId} />
    </ProjectProvider>
  );
}
