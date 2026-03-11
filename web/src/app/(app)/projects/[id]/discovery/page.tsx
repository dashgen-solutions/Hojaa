"use client";

import { useState, useEffect } from "react";
import { useProject } from "@/contexts/ProjectContext";
import { useViewerMode } from "@/hooks/useViewerMode";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/stores/useStore";
import ResizableSplitPane from "@/components/layout/ResizableSplitPane";
import TreeVisualization from "@/components/tree/TreeVisualization";
import ChatInterface from "@/components/chat/ChatInterface";
import DocumentUpload from "@/components/upload/DocumentUpload";
import InitialQuestions from "@/components/questions/InitialQuestions";
import SuggestionReview from "@/components/sources/SuggestionReview";
import ProjectToolbar from "@/components/project/ProjectToolbar";

export default function DiscoveryPage() {
  const { projectId, projectStatus, isLoading: projectLoading, refreshProject } = useProject();
  const { isAuthenticated } = useAuth();
  const readOnly = useViewerMode();
  const { currentSourceDetail, fetchSources } = useStore();

  const [currentStep, setCurrentStep] = useState<"upload" | "questions" | "tree">("upload");
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [showSourceSuggestions, setShowSourceSuggestions] = useState(false);
  const [treeRefreshKey, setTreeRefreshKey] = useState(0);

  // Determine step from project status
  useEffect(() => {
    if (projectLoading) return;

    if (projectStatus === "upload_pending") {
      setCurrentStep("upload");
    } else if (projectStatus === "questions_pending") {
      setCurrentStep("questions");
    } else {
      setCurrentStep("tree");
    }
  }, [projectStatus, projectLoading]);

  const handleDocumentUpload = async () => {
    setCurrentStep("questions");
    await refreshProject();
  };

  const handleQuestionsComplete = () => {
    setCurrentStep("tree");
    fetchSources(projectId);
    refreshProject();
  };

  const handleNodeSelect = (nodeId: string) => {
    setSelectedNode(nodeId);
  };

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-neutral-50 dark:bg-[#060606]">
        <div className="text-center animate-fade-in">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-neutral-200 dark:border-neutral-700"></div>
            <div className="absolute inset-0 rounded-full border-4 border-neutral-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-neutral-500 font-medium dark:text-neutral-400">Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Guest User Banner */}
      {!isAuthenticated && currentStep === "upload" && (
        <div className="bg-neutral-900 text-white px-4 py-2.5 text-center text-sm flex-shrink-0">
          <span className="opacity-90">You&apos;re exploring as a guest.</span>
          <a href="/login" className="ml-2 font-semibold hover:underline">Sign in</a>
          <span className="mx-1.5 opacity-60">or</span>
          <a href="/register" className="font-semibold hover:underline">Create account</a>
          <span className="ml-2 opacity-90">to save your work</span>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-hidden flex">
        {currentStep === "upload" && (
          <div className="w-full h-full overflow-y-auto">
            <div className="min-h-full flex items-center justify-center p-6">
              <DocumentUpload sessionId={projectId} onUpload={handleDocumentUpload} />
            </div>
          </div>
        )}

        {currentStep === "questions" && (
          <div className="w-full h-full overflow-y-auto">
            <div className="min-h-full flex items-center justify-center p-6">
              <InitialQuestions sessionId={projectId} onComplete={handleQuestionsComplete} />
            </div>
          </div>
        )}

        {currentStep === "tree" && (
          <>
            {/* Source suggestions panel */}
            {showSourceSuggestions && currentSourceDetail?.suggestions && (
              <>
                <div
                  className="fixed inset-0 z-[90] bg-black/20"
                  onClick={() => setShowSourceSuggestions(false)}
                />
                <div className="fixed top-[48px] bottom-0 right-0 z-[95] w-[460px] bg-white dark:bg-neutral-900 shadow-lg border-l border-neutral-200 dark:border-neutral-700 flex flex-col">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-700 shrink-0">
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {currentSourceDetail.source_name || "Source Details"}
                      </h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        {currentSourceDetail.source_type || "source"} &middot;{" "}
                        {currentSourceDetail.is_processed ? "Processed" : "Pending"}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowSourceSuggestions(false)}
                      className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <span className="sr-only">Close</span>
                      <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {currentSourceDetail.processed_summary && (
                      <div className="px-5 py-3 bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                        <p className="text-xs font-medium text-neutral-900 dark:text-neutral-100 mb-1">AI Summary</p>
                        <p className="text-xs text-neutral-900 dark:text-neutral-300 leading-relaxed">
                          {currentSourceDetail.processed_summary}
                        </p>
                      </div>
                    )}

                    {currentSourceDetail.source_metadata?.action_items?.length > 0 && (
                      <div className="px-5 py-3 border-b border-neutral-100 dark:border-neutral-700">
                        <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Action Items</p>
                        <ul className="space-y-1">
                          {currentSourceDetail.source_metadata.action_items.map((item: string, index: number) => (
                            <li key={index} className="text-xs text-neutral-600 dark:text-neutral-400 flex items-start gap-1.5">
                              <span className="text-amber-500 mt-0.5">●</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {currentSourceDetail.source_metadata?.questions_raised?.length > 0 && (
                      <div className="px-5 py-3 border-b border-neutral-100 dark:border-neutral-700">
                        <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Unresolved Questions</p>
                        <ul className="space-y-1">
                          {currentSourceDetail.source_metadata.questions_raised.map((question: string, index: number) => (
                            <li key={index} className="text-xs text-neutral-600 dark:text-neutral-400 flex items-start gap-1.5">
                              <span className="text-blue-500 mt-0.5">?</span>
                              {question}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {currentSourceDetail.raw_content && (
                      <details className="px-5 py-3 border-b border-neutral-100 dark:border-neutral-700">
                        <summary className="text-xs font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer hover:text-neutral-900 dark:hover:text-neutral-100">
                          Original Content
                        </summary>
                        <pre className="mt-2 text-xs text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap bg-neutral-50 dark:bg-neutral-800 rounded-md p-3 max-h-40 overflow-y-auto">
                          {currentSourceDetail.raw_content}
                        </pre>
                      </details>
                    )}

                    {!readOnly && (
                      <div className="px-5 py-4">
                        <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                          Scope Change Suggestions ({currentSourceDetail.suggestions.length})
                        </p>
                        <SuggestionReview
                          suggestions={currentSourceDetail.suggestions}
                          sourceId={currentSourceDetail.id}
                          sessionId={projectId}
                          onComplete={() => {
                            setShowSourceSuggestions(false);
                            setTreeRefreshKey((prev) => prev + 1);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {selectedNode ? (
              <div className="w-full h-full flex flex-col">
                <div className="bg-white dark:bg-neutral-900 m-2 mb-0 rounded-t-md shadow-sm">
                  <ProjectToolbar
                    onInputAdded={() => setShowSourceSuggestions(true)}
                    onSelectInput={() => setShowSourceSuggestions(true)}
                  />
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <ResizableSplitPane
                    leftPanel={
                      <div className="h-full bg-white dark:bg-neutral-900 overflow-hidden rounded-bl-md shadow-sm ml-2 mr-1">
                        <TreeVisualization
                          sessionId={projectId}
                          onNodeSelect={handleNodeSelect}
                          selectedNodeId={selectedNode}
                          refreshKey={treeRefreshKey}
                          readOnly={readOnly}
                        />
                      </div>
                    }
                    rightPanel={
                      <div className="h-full rounded-br-md shadow-sm mr-2 ml-1 bg-white dark:bg-neutral-900" style={{ overflow: 'clip' }}>
                        <ChatInterface
                          sessionId={projectId}
                          selectedNodeId={selectedNode}
                          contextMessage="Let's explore this feature in detail..."
                          onClose={() => setSelectedNode(null)}
                          readOnly={readOnly}
                        />
                      </div>
                    }
                    defaultLeftWidth={50}
                    minLeftWidth={20}
                    maxLeftWidth={80}
                  />
                </div>
              </div>
            ) : (
              <div className="w-full h-full p-2">
                <div className="h-full bg-white dark:bg-neutral-900 overflow-hidden rounded-md shadow-sm flex flex-col">
                  <ProjectToolbar
                    onInputAdded={() => setShowSourceSuggestions(true)}
                    onSelectInput={() => setShowSourceSuggestions(true)}
                  />
                  <div className="flex-1 overflow-hidden">
                    <TreeVisualization
                      sessionId={projectId}
                      onNodeSelect={handleNodeSelect}
                      selectedNodeId={null}
                      refreshKey={treeRefreshKey}
                      readOnly={readOnly}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
