"use client";

import {
  ArrowRightOnRectangleIcon, Squares2X2Icon,
  ViewColumnsIcon, ClockIcon, DocumentArrowDownIcon,
  ShieldCheckIcon, Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useViewerMode } from "@/hooks/useViewerMode";

interface HeaderProps {
  sessionId?: string | null;
  onExport?: () => void;
}

export default function Header({ sessionId, onExport }: HeaderProps) {
  const { user, isAuthenticated, isOrgAdmin, logout, isLoading } = useAuth();
  const pathname = usePathname();
  const isViewer = useViewerMode();

  const isNavActive = (path: string) => pathname === path;

  return (
    <header className="bg-white border-b border-neutral-200 flex-shrink-0 relative z-50" style={{ height: "48px" }}>
      <div className="flex items-center justify-between px-4 h-full">
        {/* Left Side - Logo + Navigation */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 bg-neutral-900 rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="text-[15px] font-semibold text-neutral-900">MoMetric</span>
          </Link>

          <div className="hidden md:flex items-center">
            <div className="w-px h-4 bg-neutral-200 mr-3"></div>
            <span className="text-[12px] text-neutral-500">Scope Lifecycle</span>
          </div>

          {/* Main Navigation */}
          {sessionId && (
            <nav className="hidden md:flex items-center gap-0.5 ml-1">
              <Link
                href="/"
                className={`text-[13px] px-2.5 py-1 rounded transition-all ${
                  isNavActive('/')
                    ? 'bg-neutral-100 text-neutral-900 font-medium'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                }`}
              >
                Discovery
              </Link>
              <Link
                href={`/planning?session=${sessionId}`}
                className={`flex items-center gap-1.5 text-[13px] px-2.5 py-1 rounded transition-all ${
                  isNavActive('/planning')
                    ? 'bg-neutral-100 text-neutral-900 font-medium'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                }`}
              >
                <ViewColumnsIcon className="w-3.5 h-3.5" />
                Planning
              </Link>
              {!isViewer && (
                <Link
                  href={`/audit?session=${sessionId}`}
                  className={`flex items-center gap-1.5 text-[13px] px-2.5 py-1 rounded transition-all ${
                    isNavActive('/audit')
                      ? 'bg-neutral-100 text-neutral-900 font-medium'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                  }`}
                >
                  <ClockIcon className="w-3.5 h-3.5" />
                  Audit
                </Link>
              )}
              {onExport && (
                <button
                  onClick={onExport}
                  className="flex items-center gap-1.5 text-[13px] px-2.5 py-1 rounded text-neutral-600
                             hover:text-neutral-900 hover:bg-neutral-50 transition-all"
                >
                  <DocumentArrowDownIcon className="w-3.5 h-3.5" />
                  Export
                </button>
              )}
            </nav>
          )}
        </div>

        {/* Right Side - Actions */}
        <div className="flex items-center gap-1">
          {!isLoading && (
            <>
              {isAuthenticated ? (
                <>
                  <Link
                    href="/sessions"
                    className="flex items-center gap-1.5 text-[13px] text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 transition-all px-2.5 py-1 rounded"
                  >
                    <Squares2X2Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Sessions</span>
                  </Link>

                  {isOrgAdmin && (
                    <Link
                      href="/admin"
                      className={`flex items-center gap-1.5 text-[13px] transition-all px-2.5 py-1 rounded ${
                        isNavActive('/admin')
                          ? 'bg-neutral-100 text-neutral-900 font-medium'
                          : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                      }`}
                    >
                      <ShieldCheckIcon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Admin</span>
                    </Link>
                  )}

                  <Link
                    href="/settings"
                    className={`flex items-center gap-1.5 text-[13px] transition-all px-2.5 py-1 rounded ${
                      isNavActive('/settings')
                        ? 'bg-neutral-100 text-neutral-900 font-medium'
                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                    }`}
                  >
                    <Cog6ToothIcon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Settings</span>
                  </Link>

                  <div className="w-px h-4 bg-neutral-200 mx-1"></div>

                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-50">
                    <div className="w-5 h-5 rounded-full bg-neutral-900 flex items-center justify-center">
                      <span className="text-white text-[10px] font-semibold">
                        {user?.username?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-[13px] font-medium text-neutral-700 hidden sm:inline">
                      {user?.username}
                    </span>
                  </div>

                  <button
                    onClick={logout}
                    className="flex items-center gap-1 text-[13px] text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50 transition-all px-2 py-1 rounded"
                    title="Sign out"
                  >
                    <ArrowRightOnRectangleIcon className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-[13px] text-neutral-600 hover:text-neutral-900 transition-colors px-2.5 py-1 rounded hover:bg-neutral-50"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/register"
                    className="text-[13px] bg-neutral-900 text-white hover:bg-neutral-800 transition-all px-3 py-1 rounded font-medium"
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
