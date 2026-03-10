"use client";

import { useEffect, useState } from "react";
import { ExclamationTriangleIcon, XMarkIcon } from "@heroicons/react/24/outline";

/**
 * Listens for the `ai-usage-limit` custom event dispatched by the Axios 402
 * interceptor and renders a dismissible warning banner.
 */
export default function AIUsageLimitBanner() {
  const [info, setInfo] = useState<{ message: string; used_usd: number; limit_usd: number } | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setInfo(detail);
    };
    window.addEventListener("ai-usage-limit", handler);
    return () => window.removeEventListener("ai-usage-limit", handler);
  }, []);

  if (!info) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-lg animate-fade-in-up">
      <div className="mx-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/80 dark:border-amber-700 p-4 shadow-lg">
        <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div className="flex-1 text-sm text-amber-800 dark:text-amber-200">
          <p className="font-semibold mb-1">AI Usage Limit Reached</p>
          <p>{info.message}</p>
        </div>
        <button
          onClick={() => setInfo(null)}
          className="shrink-0 text-amber-500 hover:text-amber-700 dark:hover:text-amber-300"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
