"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRightIcon, Bars3Icon } from "@heroicons/react/24/outline";
import { useOptionalProject } from "@/contexts/ProjectContext";

interface AppHeaderProps {
  onToggleSidebar?: () => void;
}

export default function AppHeader({ onToggleSidebar }: AppHeaderProps) {
  const pathname = usePathname();
  const project = useOptionalProject();

  const buildBreadcrumbs = () => {
    const crumbs: { label: string; href?: string }[] = [];

    const projectMatch = pathname.match(/\/projects\/([^/]+)/);
    const projectId = projectMatch ? projectMatch[1] : null;

    if (pathname === "/projects" || pathname.startsWith("/projects")) {
      crumbs.push({ label: "Projects", href: "/projects" });
    }

    if (projectId) {
      const name = project?.projectName || "Project";
      crumbs.push({
        label: name,
        href: `/projects/${projectId}/discovery`,
      });

      if (pathname.includes("/discovery")) {
        crumbs.push({ label: "Discovery" });
      } else if (pathname.includes("/planning")) {
        crumbs.push({ label: "Planning" });
      } else if (pathname.includes("/audit")) {
        crumbs.push({ label: "Audit" });
      } else if (pathname.includes("/documents")) {
        crumbs.push({ label: "Documents" });
      } else if (pathname.includes("/export")) {
        crumbs.push({ label: "Export" });
      }
    }

    if (pathname === "/settings") {
      crumbs.push({ label: "Settings" });
    }

    if (pathname === "/admin") {
      crumbs.push({ label: "Admin" });
    }

    if (pathname === "/messages") {
      crumbs.push({ label: "Messages" });
    }

    return crumbs;
  };

  const breadcrumbs = buildBreadcrumbs();

  return (
    <header
      className="bg-white border-b border-neutral-200 flex-shrink-0 relative z-40"
      style={{ height: "48px" }}
    >
      <div className="flex items-center justify-between px-4 h-full">
        <div className="flex items-center gap-1.5 min-w-0">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="md:hidden p-1.5 rounded hover:bg-neutral-100 transition-colors mr-1"
            >
              <Bars3Icon className="w-5 h-5 text-neutral-600" />
            </button>
          )}

          <nav className="flex items-center gap-1 min-w-0 text-[13px]">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <div key={index} className="flex items-center gap-1 min-w-0">
                  {index > 0 && (
                    <ChevronRightIcon className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                  )}
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="text-neutral-500 hover:text-neutral-900 transition-colors truncate"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-neutral-900 font-medium truncate">
                      {crumb.label}
                    </span>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Project-level actions can be added here */}
        </div>
      </div>
    </header>
  );
}
