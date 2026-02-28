"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { createSession } from "@/lib/api";
import {
  BriefcaseIcon,
  CodeBracketIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import HojaaLogo from '@/components/brand/HojaaLogo';
import MarketingLanding from '@/components/marketing/MarketingLanding';

function LoadingSpinner({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center h-screen w-screen bg-neutral-50 dark:bg-[#060606]">
      <div className="text-center animate-fade-in">
        <div className="relative w-16 h-16 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-neutral-200 dark:border-neutral-700"></div>
          <div className="absolute inset-0 rounded-full border-4 border-neutral-500 dark:border-neutral-400 border-t-transparent animate-spin"></div>
        </div>
        <p className="text-neutral-500 dark:text-neutral-400 font-medium">{message}</p>
      </div>
    </div>
  );
}

function UserTypeModal({
  isAuthenticated,
  onSelect,
  onCancel,
}: {
  isAuthenticated: boolean;
  onSelect: (type: "technical" | "non_technical") => void;
  onCancel?: () => void;
}) {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#060606] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-md shadow max-w-2xl w-full overflow-hidden animate-scale-in">
        <div className="px-8 pt-10 pb-6 text-center">
          <HojaaLogo size={48} showText={false} className="mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            {isAuthenticated ? "New Project" : "Welcome to Hojaa"}
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-base max-w-md mx-auto">
            Help us personalize your experience by telling us about your background
          </p>
        </div>

        <div className="px-8 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => onSelect("non_technical")}
              className="group relative bg-white dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 rounded-md p-6 transition-all duration-200 text-left hover:shadow-sm"
            >
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRightIcon className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
              </div>
              <div className="w-12 h-12 rounded-md bg-amber-500 flex items-center justify-center mb-4 shadow-sm">
                <BriefcaseIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-1">Business</h3>
              <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-4">
                Focused on goals, user needs, and outcomes
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-900 dark:bg-neutral-100"></div>
                  <span>Business-focused questions</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-900 dark:bg-neutral-100"></div>
                  <span>Clear, simple language</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-900 dark:bg-neutral-100"></div>
                  <span>Problems &amp; solutions focus</span>
                </div>
              </div>
            </button>

            <button
              onClick={() => onSelect("technical")}
              className="group relative bg-white dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 rounded-md p-6 transition-all duration-200 text-left hover:shadow-sm"
            >
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRightIcon className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
              </div>
              <div className="w-12 h-12 rounded-md bg-violet-600 flex items-center justify-center mb-4 shadow-sm">
                <CodeBracketIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-1">Technical</h3>
              <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-4">
                Understands architecture and implementation
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-900 dark:bg-neutral-100"></div>
                  <span>Technical + business questions</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-900 dark:bg-neutral-100"></div>
                  <span>Architecture details</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-900 dark:bg-neutral-100"></div>
                  <span>Tech stack &amp; integrations</span>
                </div>
              </div>
            </button>
          </div>

          <p className="text-center text-sm text-neutral-400 dark:text-neutral-500 mt-6">
            This helps us tailor the discovery experience for you
          </p>

          {onCancel && (
            <div className="text-center mt-4">
              <button
                onClick={onCancel}
                className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
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
    }
    // Unauthenticated users see the marketing landing page (no redirect needed)
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

  // Show loading while checking auth
  if (authLoading) {
    return <LoadingSpinner message="Loading..." />;
  }

  // Creating a project
  if (isCreating) {
    return <LoadingSpinner message="Creating your project..." />;
  }

  // Authenticated user with ?new=true — show user type modal
  if (isAuthenticated && showUserTypeModal) {
    return (
      <UserTypeModal
        isAuthenticated
        onSelect={handleUserTypeSelection}
        onCancel={() => router.push("/projects")}
      />
    );
  }

  // Authenticated user without ?new=true — show redirect spinner
  if (isAuthenticated) {
    return <LoadingSpinner message="Redirecting..." />;
  }

  // Unauthenticated user — show marketing landing page
  return <MarketingLanding />;
}

export default function RootPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <RootPageContent />
    </Suspense>
  );
}
