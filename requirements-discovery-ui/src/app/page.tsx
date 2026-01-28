"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import ResizableSplitPane from "@/components/layout/ResizableSplitPane";
import TreeVisualization from "@/components/tree/TreeVisualization";
import ChatInterface from "@/components/chat/ChatInterface";
import DocumentUpload from "@/components/upload/DocumentUpload";
import InitialQuestions from "@/components/questions/InitialQuestions";
import { createSession } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  BriefcaseIcon,
  CodeBracketIcon,
  SparklesIcon,
  ArrowRightIcon
} from "@heroicons/react/24/outline";

export default function Home() {
  const [currentStep, setCurrentStep] = useState<"upload" | "questions" | "tree">("upload");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [showTreeView, setShowTreeView] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showUserTypeModal, setShowUserTypeModal] = useState(false);
  const [userType, setUserType] = useState<'technical' | 'non_technical' | null>(null);
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initSession = async () => {
      if (isInitialized) return;

      try {
        const existingSessionId = localStorage.getItem("current_session_id");
        const resumeSessionStatus = localStorage.getItem("resume_session_status");
        const startingNewSession = localStorage.getItem("start_new_session");

        if (existingSessionId) {
          setSessionId(existingSessionId);

          let actualStatus = resumeSessionStatus;
          try {
            const { default: api } = await import("@/lib/api");
            const sessionResponse = await api.get(`/api/sessions/${existingSessionId}`);

            if (sessionResponse.data.document_filename) {
              setSessionName(sessionResponse.data.document_filename);
            }

            if (!resumeSessionStatus) {
              actualStatus = sessionResponse.data.status;
            }
          } catch (err) {
            console.error("Failed to fetch session details:", err);
          }

          let step: "upload" | "questions" | "tree" = "upload";

          if (actualStatus === "upload_pending") {
            step = "upload";
          } else if (actualStatus === "questions_pending") {
            step = "questions";
          } else {
            step = "tree";
          }

          setCurrentStep(step);
          localStorage.removeItem("resume_session_status");
          setIsInitialized(true);
          return;
        }

        if (startingNewSession === "true") {
          localStorage.removeItem("start_new_session");
          setShowUserTypeModal(true);
          setIsInitialized(true);
          return;
        }

        if (!isAuthenticated) {
          setShowUserTypeModal(true);
          setIsInitialized(true);
          return;
        }

        setIsInitialized(true);
        router.push("/sessions");
      } catch (error) {
        console.error("Failed to initialize session:", error);
      }
    };

    if (!authLoading) {
      initSession();
    }
  }, [authLoading, isAuthenticated, router, isInitialized]);

  const handleUserTypeSelection = async (selectedType: 'technical' | 'non_technical') => {
    try {
      setUserType(selectedType);
      setShowUserTypeModal(false);
      setIsLoading(true);

      const session = await createSession(selectedType);
      setSessionId(session.id);
      setSessionName(null);
      setCurrentStep("upload");
      localStorage.setItem("current_session_id", session.id);
    } catch (error) {
      console.error("Failed to create session:", error);
      alert("Failed to create session. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDocumentUpload = async (uploadedFilename?: string) => {
    setCurrentStep("questions");
  };

  const handleQuestionsComplete = () => {
    setCurrentStep("tree");
  };

  const handleNodeSelect = (nodeId: string) => {
    setSelectedNode(nodeId);
  };

  // Loading state
  if (!sessionId && !showUserTypeModal) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-neutral-50">
        <div className="text-center animate-fade-in">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-neutral-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-neutral-500 font-medium">Setting things up...</p>
        </div>
      </div>
    );
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-neutral-50">
        <div className="text-center animate-fade-in">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-neutral-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-neutral-500 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-neutral-50">
      <Header />

      {/* Guest User Banner */}
      {!isAuthenticated && currentStep === "upload" && (
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-2.5 text-center text-sm">
          <span className="opacity-90">You're exploring as a guest.</span>
          <a href="/login" className="ml-2 font-semibold hover:underline">
            Sign in
          </a>
          <span className="mx-1.5 opacity-60">or</span>
          <a href="/register" className="font-semibold hover:underline">
            Create account
          </a>
          <span className="ml-2 opacity-90">to save your work</span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          currentSessionId={sessionId}
          sessionName={sessionName}
          onSessionNameUpdate={setSessionName}
        />

        <main className="flex-1 flex overflow-hidden">
          {currentStep === "upload" && (
            <div className="w-full h-full overflow-y-auto flex items-center justify-center p-6">
              <DocumentUpload sessionId={sessionId} onUpload={handleDocumentUpload} />
            </div>
          )}

          {currentStep === "questions" && (
            <div className="w-full h-full overflow-y-auto flex items-center justify-center p-6">
              <InitialQuestions
                sessionId={sessionId}
                onComplete={handleQuestionsComplete}
              />
            </div>
          )}

          {currentStep === "tree" && (
            <>
              {selectedNode ? (
                <ResizableSplitPane
                  leftPanel={
                    <div className="h-full bg-white overflow-hidden rounded-xl shadow-soft-sm m-2 mr-1">
                      <TreeVisualization
                        sessionId={sessionId}
                        onNodeSelect={handleNodeSelect}
                        selectedNodeId={selectedNode}
                      />
                    </div>
                  }
                  rightPanel={
                    <div className="h-full flex flex-col rounded-xl shadow-soft-sm m-2 ml-1 overflow-hidden">
                      <ChatInterface
                        sessionId={sessionId}
                        selectedNodeId={selectedNode}
                        contextMessage="Let's explore this feature in detail..."
                        onClose={() => setSelectedNode(null)}
                      />
                    </div>
                  }
                  defaultLeftWidth={50}
                  minLeftWidth={20}
                  maxLeftWidth={80}
                />
              ) : (
                <div className="w-full h-full p-2">
                  <div className="h-full bg-white overflow-hidden rounded-xl shadow-soft-sm">
                    <TreeVisualization
                      sessionId={sessionId}
                      onNodeSelect={handleNodeSelect}
                      selectedNodeId={null}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* User Type Selection Modal */}
      {showUserTypeModal && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-soft-xl max-w-2xl w-full overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="px-8 pt-10 pb-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 mb-6 shadow-glow">
                <SparklesIcon className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-neutral-900 mb-2">
                Welcome to MoMetric
              </h2>
              <p className="text-neutral-500 text-base max-w-md mx-auto">
                Help us personalize your experience by telling us about your background
              </p>
            </div>

            {/* Options */}
            <div className="px-8 pb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Non-Technical Option */}
                <button
                  onClick={() => handleUserTypeSelection('non_technical')}
                  className="group relative bg-white border-2 border-neutral-200 hover:border-primary-400 rounded-2xl p-6 transition-all duration-300 text-left hover:shadow-soft-md"
                >
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRightIcon className="w-5 h-5 text-primary-500" />
                  </div>

                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4 shadow-soft-sm">
                    <BriefcaseIcon className="w-6 h-6 text-white" />
                  </div>

                  <h3 className="text-lg font-semibold text-neutral-900 mb-1">
                    Business
                  </h3>
                  <p className="text-neutral-500 text-sm mb-4">
                    Focused on goals, user needs, and outcomes
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary-500"></div>
                      <span>Business-focused questions</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary-500"></div>
                      <span>Clear, simple language</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary-500"></div>
                      <span>Problems & solutions focus</span>
                    </div>
                  </div>
                </button>

                {/* Technical Option */}
                <button
                  onClick={() => handleUserTypeSelection('technical')}
                  className="group relative bg-white border-2 border-neutral-200 hover:border-primary-400 rounded-2xl p-6 transition-all duration-300 text-left hover:shadow-soft-md"
                >
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRightIcon className="w-5 h-5 text-primary-500" />
                  </div>

                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-4 shadow-soft-sm">
                    <CodeBracketIcon className="w-6 h-6 text-white" />
                  </div>

                  <h3 className="text-lg font-semibold text-neutral-900 mb-1">
                    Technical
                  </h3>
                  <p className="text-neutral-500 text-sm mb-4">
                    Understands architecture and implementation
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary-500"></div>
                      <span>Technical + business questions</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary-500"></div>
                      <span>Architecture details</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary-500"></div>
                      <span>Tech stack & integrations</span>
                    </div>
                  </div>
                </button>
              </div>

              <p className="text-center text-sm text-neutral-400 mt-6">
                This helps us tailor the discovery experience for you
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
