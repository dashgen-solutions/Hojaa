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

  // Track if session is already initialized to prevent double initialization
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize session on mount
  useEffect(() => {
    const initSession = async () => {
      if (isInitialized) {
        console.log("⚠️ Already initialized, skipping...");
        return;
      }
      
      console.log("=== HOME PAGE INIT ===");
      console.log("Auth loading:", authLoading);
      console.log("Is authenticated:", isAuthenticated);
      
      try {
        // Check if we're resuming an existing session
        const existingSessionId = localStorage.getItem("current_session_id");
        const resumeSessionStatus = localStorage.getItem("resume_session_status");
        const startingNewSession = localStorage.getItem("start_new_session");
        
        console.log("LocalStorage check:");
        console.log("- current_session_id:", existingSessionId);
        console.log("- resume_session_status:", resumeSessionStatus);
        console.log("- start_new_session:", startingNewSession);
        
        // PRIORITY 1: Resume existing session
        if (existingSessionId) {
          console.log("✅ RESUMING SESSION:", existingSessionId);
          console.log("About to set session ID...");
          setSessionId(existingSessionId);
          console.log("Session ID set!");
          
          // Fetch session details to get the name AND status
          let actualStatus = resumeSessionStatus;
          try {
            const { default: api } = await import("@/lib/api");
            const sessionResponse = await api.get(`/api/sessions/${existingSessionId}`);
            
            // Set session name
            if (sessionResponse.data.document_filename) {
              console.log("📝 Setting session name:", sessionResponse.data.document_filename);
              setSessionName(sessionResponse.data.document_filename);
            }
            
            // If resume_session_status not in localStorage (page reload), use actual status from backend
            if (!resumeSessionStatus) {
              actualStatus = sessionResponse.data.status;
              console.log("🔄 Using actual status from backend:", actualStatus);
            }
          } catch (err) {
            console.error("Failed to fetch session details:", err);
          }
          
          // Determine which step to show based on session status
          let step: "upload" | "questions" | "tree" = "upload";
          
          console.log("Checking session status:", actualStatus);
          if (actualStatus === "upload_pending") {
            step = "upload";
            console.log("→ Step: UPLOAD (status: upload_pending)");
          } else if (actualStatus === "questions_pending") {
            step = "questions";
            console.log("→ Step: QUESTIONS (status: questions_pending)");
          } else {
            // tree_generated, active, or completed status
            step = "tree";
            console.log("→ Step: TREE (status:", actualStatus, ")");
          }
          
          console.log("About to set current step to:", step);
          setCurrentStep(step);
          console.log("Current step set!");
          
          // Keep current_session_id in localStorage for page reloads
          // Only clear the resume status flag
          console.log("Clearing resume status flag...");
          localStorage.removeItem("resume_session_status");
          console.log("✅ Session loaded successfully - should render now!");
          setIsInitialized(true);
          return;
        }
        
        // PRIORITY 2: Create new session for authenticated user
        if (startingNewSession === "true") {
          console.log("✅ CREATING NEW SESSION (authenticated user)");
          localStorage.removeItem("start_new_session");
          // Show user type selection modal
          setShowUserTypeModal(true);
          setIsInitialized(true);
          return;
        }
        
        // PRIORITY 3: Create session for guest user
        if (!isAuthenticated) {
          console.log("✅ CREATING NEW SESSION (guest user)");
          // Show user type selection modal
          setShowUserTypeModal(true);
          setIsInitialized(true);
          return;
        }
        
        // PRIORITY 4: Authenticated user with no session - redirect
        console.log("⚠️ No session, redirecting to /sessions");
        setIsInitialized(true);
        router.push("/sessions");
      } catch (error) {
        console.error("❌ Failed to initialize session:", error);
      }
    };
    
    if (!authLoading) {
      initSession();
    }
  }, [authLoading, isAuthenticated, router]);

  const handleUserTypeSelection = async (selectedType: 'technical' | 'non_technical') => {
    try {
      console.log("User selected type:", selectedType);
      setUserType(selectedType);
      setShowUserTypeModal(false);
      
      // Create session with selected user type
      const session = await createSession(selectedType);
      console.log("Session created:", session.id);
      setSessionId(session.id);
      setSessionName(null);
      setCurrentStep("upload");
      
      // Store session ID in localStorage for page reloads
      localStorage.setItem("current_session_id", session.id);
    } catch (error) {
      console.error("Failed to create session:", error);
      alert("Failed to create session. Please try again.");
    }
  };

  const handleDocumentUpload = async (uploadedFilename?: string) => {
    console.log("📤 Document uploaded, filename:", uploadedFilename);
    console.log("Current session name:", sessionName);
    
    // Session name remains "Untitled" - user can rename it manually using the sidebar
    // No automatic renaming based on uploaded filename
    
    setCurrentStep("questions");
  };

  const handleQuestionsComplete = () => {
    setCurrentStep("tree");
  };

  const handleNodeSelect = (nodeId: string) => {
    setSelectedNode(nodeId);
  };

  // Show user type modal if needed (don't show loading screen)
  if (!sessionId && !showUserTypeModal) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-secondary-600">Initializing session...</p>
        </div>
      </div>
    );
  }

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-secondary-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {/* Header */}
      <Header />

      {/* Guest User Banner */}
      {!isAuthenticated && currentStep === "upload" && (
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-4 py-2 text-center text-sm">
          👋 You're using as a guest. Sessions won't be saved.{" "}
          <a href="/login" className="underline font-semibold hover:text-primary-100">
            Login
          </a>{" "}
          or{" "}
          <a href="/register" className="underline font-semibold hover:text-primary-100">
            Sign up
          </a>{" "}
          to save your work!
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar 
          currentSessionId={sessionId}
          sessionName={sessionName}
          onSessionNameUpdate={setSessionName}
        />

        {/* Main Content */}
        <main className="flex-1 flex overflow-hidden bg-secondary-50">
          {/* Step 1: Document Upload */}
          {currentStep === "upload" && (
            <div className="w-full h-full overflow-y-auto flex items-center justify-center">
              <DocumentUpload sessionId={sessionId} onUpload={handleDocumentUpload} />
            </div>
          )}

          {/* Step 2: Initial 10 Questions */}
          {currentStep === "questions" && (
            <div className="w-full h-full overflow-y-auto flex items-center justify-center py-8">
              <InitialQuestions
                sessionId={sessionId}
                onComplete={handleQuestionsComplete}
              />
            </div>
          )}

          {/* Step 3: Tree + Contextual Chat */}
          {currentStep === "tree" && (
            <>
              {/* Show chat only when a node is selected */}
              {selectedNode ? (
                <ResizableSplitPane
                  leftPanel={
                    <div className="h-full bg-white overflow-hidden">
                      <TreeVisualization 
                        sessionId={sessionId} 
                        onNodeSelect={handleNodeSelect}
                        selectedNodeId={selectedNode}
                      />
                    </div>
                  }
                  rightPanel={
                    <div className="h-full flex flex-col">
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
                /* Full-width tree when no node selected */
                <div className="w-full h-full bg-white overflow-hidden">
                  <TreeVisualization 
                    sessionId={sessionId} 
                    onNodeSelect={handleNodeSelect}
                    selectedNodeId={null}
                  />
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* User Type Selection Modal */}
      {showUserTypeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl mx-4">
            <h2 className="text-3xl font-bold text-secondary-900 mb-4 text-center">
              Welcome to MoMetric! 👋
            </h2>
            <p className="text-secondary-600 mb-8 text-center text-lg">
              To provide you with the best experience, please tell us about your background:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Non-Technical Option */}
              <button
                onClick={() => handleUserTypeSelection('non_technical')}
                className="group relative bg-gradient-to-br from-primary-50 to-primary-100 hover:from-primary-100 hover:to-primary-200 border-2 border-primary-200 hover:border-primary-400 rounded-xl p-6 transition-all duration-200 text-left"
              >
                <div className="flex flex-col h-full">
                  <div className="text-4xl mb-4">💼</div>
                  <h3 className="text-xl font-bold text-primary-900 mb-2">
                    Business / Non-Technical
                  </h3>
                  <p className="text-secondary-700 text-sm mb-4">
                    I'm focused on business goals, user needs, and outcomes.
                  </p>
                  <ul className="text-sm text-secondary-600 space-y-2">
                    <li>• Business-focused questions</li>
                    <li>• Clear, simple language</li>
                    <li>• Focus on problems & solutions</li>
                  </ul>
                </div>
              </button>

              {/* Technical Option */}
              <button
                onClick={() => handleUserTypeSelection('technical')}
                className="group relative bg-gradient-to-br from-indigo-50 to-indigo-100 hover:from-indigo-100 hover:to-indigo-200 border-2 border-indigo-200 hover:border-indigo-400 rounded-xl p-6 transition-all duration-200 text-left"
              >
                <div className="flex flex-col h-full">
                  <div className="text-4xl mb-4">⚙️</div>
                  <h3 className="text-xl font-bold text-indigo-900 mb-2">
                    Technical / Developer
                  </h3>
                  <p className="text-secondary-700 text-sm mb-4">
                    I understand technical concepts, architecture, and implementation.
                  </p>
                  <ul className="text-sm text-secondary-600 space-y-2">
                    <li>• Business + technical questions</li>
                    <li>• Architecture & implementation</li>
                    <li>• Tech stack & integrations</li>
                  </ul>
                </div>
              </button>
            </div>

            <p className="text-xs text-secondary-500 mt-6 text-center">
              Don't worry - this just helps us ask the right questions for you!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
