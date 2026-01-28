"use client";

import { UserCircleIcon, ArrowRightOnRectangleIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function Header() {
  const { user, isAuthenticated, logout, isLoading } = useAuth();

  return (
    <header className="bg-white/80 backdrop-blur-xl border-b border-neutral-200/60 h-14 w-full flex-shrink-0 relative z-50">
      <div className="flex items-center justify-between px-4 h-full max-w-[1800px] mx-auto">
        {/* Left Side - Logo */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-soft-sm group-hover:shadow-glow transition-shadow duration-300">
              <span className="text-white font-bold text-base">M</span>
            </div>
            <span className="text-lg font-semibold text-neutral-900">MoMetric</span>
          </Link>

          <div className="hidden md:flex items-center">
            <div className="w-px h-5 bg-neutral-200 mr-4"></div>
            <span className="text-sm text-neutral-500">Requirements Discovery</span>
          </div>
        </div>

        {/* Right Side - Actions */}
        <div className="flex items-center gap-2">
          {!isLoading && (
            <>
              {isAuthenticated ? (
                <>
                  <Link
                    href="/sessions"
                    className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-all px-3 py-2 rounded-lg"
                  >
                    <Squares2X2Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">Sessions</span>
                  </Link>

                  <div className="w-px h-5 bg-neutral-200 mx-1"></div>

                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-100">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                      <span className="text-white text-xs font-semibold">
                        {user?.username?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-neutral-700 hidden sm:inline">
                      {user?.username}
                    </span>
                  </div>

                  <button
                    onClick={logout}
                    className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-all px-2.5 py-2 rounded-lg"
                    title="Sign out"
                  >
                    <ArrowRightOnRectangleIcon className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors px-3 py-2 rounded-lg hover:bg-neutral-100"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/register"
                    className="text-sm bg-neutral-900 text-white hover:bg-neutral-800 transition-all px-4 py-2 rounded-lg font-medium shadow-soft-sm hover:shadow-soft"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
