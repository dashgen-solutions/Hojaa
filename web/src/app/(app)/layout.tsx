"use client";

import { useState } from "react";
import AppSidebar from "@/components/layout/AppSidebar";
import AppHeader from "@/components/layout/AppHeader";
import APIKeySetupDialog from "@/components/onboarding/APIKeySetupDialog";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-50 dark:bg-[#060606] transition-colors">
      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar: hidden on mobile unless toggled */}
      <div className={`
        fixed inset-y-0 left-0 z-50 md:relative
        transform transition-transform duration-200 ease-in-out
        ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <AppSidebar onNavigate={() => setMobileSidebarOpen(false)} />
      </div>

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <AppHeader onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>

      <APIKeySetupDialog />
    </div>
  );
}
