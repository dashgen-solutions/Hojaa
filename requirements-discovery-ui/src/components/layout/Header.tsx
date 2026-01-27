"use client";

import { Cog6ToothIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function Header() {
  const { user, isAuthenticated, logout, isLoading } = useAuth();

  return (
    <header className="bg-white border-b border-secondary-200 h-[48px] w-full flex-shrink-0 relative z-50">
      <div className="flex items-center justify-between px-4 h-full">
        {/* Left Side - Logo & Breadcrumb */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-primary-400 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <span className="text-lg font-semibold text-secondary-900">MoMetric</span>
          </Link>
          
          <div className="flex items-center gap-2 text-sm text-secondary-500">
            <span>/</span>
            <span className="text-secondary-700 font-medium">Requirements Discovery</span>
          </div>
        </div>

        {/* Right Side - Actions */}
        <div className="flex items-center gap-3">
          {!isLoading && (
            <>
              {isAuthenticated ? (
                <>
                  <Link
                    href="/sessions"
                    className="text-sm text-secondary-600 hover:text-secondary-900 transition-colors px-3 py-1"
                  >
                    My Sessions
                  </Link>
                  
                  <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-secondary-50">
                    <UserCircleIcon className="w-5 h-5 text-secondary-600" />
                    <span className="text-sm font-medium text-secondary-900">
                      {user?.username}
                    </span>
                  </div>
                  
                  <button
                    onClick={logout}
                    className="text-sm text-secondary-600 hover:text-secondary-900 transition-colors px-3 py-1"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-sm text-secondary-600 hover:text-secondary-900 transition-colors px-3 py-1"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className="text-sm bg-primary-600 text-white hover:bg-primary-700 transition-colors px-4 py-1.5 rounded-lg"
                  >
                    Sign Up
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
