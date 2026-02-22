"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { createSession } from "@/lib/api";
import {
  BriefcaseIcon,
  CodeBracketIcon,
  SparklesIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

function LoadingSpinner({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center h-screen w-screen bg-neutral-50">
      <div className="text-center animate-fade-in">
        <div className="relative w-16 h-16 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-neutral-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-neutral-500 border-t-transparent animate-spin"></div>
        </div>
        <p className="text-neutral-500 font-medium">{message}</p>
      </div>
    </div>
  );
}

function RootPageContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showUserTypeModal, setShowUserTypeModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (isAuthenticated) {
      if (searchParams.get("new") === "true") {
        setShowUserTypeModal(true);
      } else {
        router.replace("/projects");
      }
    } else {
      setShowUserTypeModal(true);
    }
  }, [authLoading, isAuthenticated, router, searchParams]);

  const handleUserTypeSelection = async (selectedType: "technical" | "non_technical") => {
    try {
      setShowUserTypeModal(false);
      setIsCreating(true);
      const session = await createSession(selectedType);
      router.push(`/projects/${session.id}/discovery`);
    } catch (error) {
      console.error("Failed to create project:", error);
      alert("Failed to create project. Please try again.");
      setIsCreating(false);
      setShowUserTypeModal(true);
    }
  };

  if (authLoading || isCreating) {
    return <LoadingSpinner message={isCreating ? "Creating your project..." : "Loading..."} />;
  }

  if (!showUserTypeModal) {
    return <LoadingSpinner message="Redirecting..." />;
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      {!isAuthenticated && (
        <div className="fixed top-0 left-0 right-0 bg-neutral-900 text-white px-4 py-2.5 text-center text-sm z-50">
          <span className="opacity-90">You&apos;re exploring as a guest.</span>
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

      <div className="bg-white rounded-md shadow max-w-2xl w-full overflow-hidden animate-scale-in">
        <div className="px-8 pt-10 pb-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-md bg-neutral-900 mb-6">
            <SparklesIcon className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">
            {isAuthenticated ? "New Project" : "Welcome to MoMetric"}
          </h2>
          <p className="text-neutral-500 text-base max-w-md mx-auto">
            Help us personalize your experience by telling us about your background
          </p>
        </div>

        <div className="px-8 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => handleUserTypeSelection("non_technical")}
              className="group relative bg-white border-2 border-neutral-200 hover:border-neutral-300 rounded-md p-6 transition-all duration-200 text-left hover:shadow-sm"
            >
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRightIcon className="w-5 h-5 text-neutral-700" />
              </div>
              <div className="w-12 h-12 rounded-md bg-amber-500 flex items-center justify-center mb-4 shadow-sm">
                <BriefcaseIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-1">Business</h3>
              <p className="text-neutral-500 text-sm mb-4">
                Focused on goals, user needs, and outcomes
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-900"></div>
                  <span>Business-focused questions</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-900"></div>
                  <span>Clear, simple language</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-900"></div>
                  <span>Problems & solutions focus</span>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleUserTypeSelection("technical")}
              className="group relative bg-white border-2 border-neutral-200 hover:border-neutral-300 rounded-md p-6 transition-all duration-200 text-left hover:shadow-sm"
            >
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRightIcon className="w-5 h-5 text-neutral-700" />
              </div>
              <div className="w-12 h-12 rounded-md bg-violet-600 flex items-center justify-center mb-4 shadow-sm">
                <CodeBracketIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-1">Technical</h3>
              <p className="text-neutral-500 text-sm mb-4">
                Understands architecture and implementation
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-900"></div>
                  <span>Technical + business questions</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-900"></div>
                  <span>Architecture details</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-900"></div>
                  <span>Tech stack & integrations</span>
                </div>
              </div>
            </button>
          </div>

          <p className="text-center text-sm text-neutral-400 mt-6">
            This helps us tailor the discovery experience for you
          </p>

          {isAuthenticated && (
            <div className="text-center mt-4">
              <button
                onClick={() => router.push("/projects")}
                className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
              >
                Cancel and go back to projects
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RootPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <RootPageContent />
    </Suspense>
  );
}
