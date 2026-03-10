"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import axios from "axios";
import { useAuth } from "./AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ProjectContextType {
  projectId: string;
  projectName: string;
  projectStatus: string;
  isLoading: boolean;
  error: string | null;
  refreshProject: () => Promise<void>;
  updateProjectName: (name: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

interface ProjectProviderProps {
  projectId: string;
  children: ReactNode;
}

export function ProjectProvider({ projectId, children }: ProjectProviderProps) {
  const { token } = useAuth();
  const [projectName, setProjectName] = useState("Untitled Project");
  const [projectStatus, setProjectStatus] = useState("upload_pending");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await axios.get(`${API_URL}/api/sessions/${projectId}`, { headers });
      const data = response.data;

      setProjectName(data.document_filename || "Untitled Project");
      setProjectStatus(data.status);
    } catch (err: any) {
      console.error("Failed to fetch project:", err);
      setError(err.response?.data?.detail || "Failed to load project");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, token]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const updateProjectName = useCallback(async (name: string) => {
    if (!token) return;

    try {
      await axios.patch(
        `${API_URL}/api/sessions/${projectId}`,
        { document_filename: name },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProjectName(name);
      // Notify sidebar and other components
      window.dispatchEvent(new CustomEvent('projectRenamed', { detail: { id: projectId, name } }));
    } catch (err) {
      console.error("Failed to update project name:", err);
    }
  }, [projectId, token]);

  const value: ProjectContextType = {
    projectId,
    projectName,
    projectStatus,
    isLoading,
    error,
    refreshProject: fetchProject,
    updateProjectName,
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}

/** Safe version that returns null when not inside a ProjectProvider */
export function useOptionalProject(): ProjectContextType | null {
  return useContext(ProjectContext) ?? null;
}
