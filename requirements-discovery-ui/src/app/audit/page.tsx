'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Header from '@/components/layout/Header';
import AuditTimeline from '@/components/audit/AuditTimeline';

function AuditContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-50">
        <div className="text-center">
          <p className="text-neutral-500">No session selected.</p>
          <a href="/sessions" className="text-primary-600 hover:underline text-sm mt-2 inline-block">
            Go to Sessions
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-neutral-50">
      <Header sessionId={sessionId} />
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <AuditTimeline sessionId={sessionId} />
      </div>
    </div>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-neutral-50">
        <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    }>
      <AuditContent />
    </Suspense>
  );
}
