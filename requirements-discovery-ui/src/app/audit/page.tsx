'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import Header from '@/components/layout/Header';
import AuditTimeline from '@/components/audit/AuditTimeline';
import BulkNodeActions from '@/components/audit/BulkNodeActions';
import TimeTravelView from '@/components/audit/TimeTravelView';
import NotificationSettings from '@/components/audit/NotificationSettings';

function AuditContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');
  const [activeTab, setActiveTab] = useState<'timeline' | 'nodes' | 'timetravel' | 'notifications'>('timeline');

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

      {/* Tab bar */}
      <div className="px-6 pt-4">
        <div className="flex gap-1 bg-neutral-200/60 rounded-lg p-0.5 w-fit">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'timeline'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-800'
            }`}
          >
            Change History
          </button>
          <button
            onClick={() => setActiveTab('nodes')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'nodes'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-800'
            }`}
          >
            Manage Nodes
          </button>
          <button
            onClick={() => setActiveTab('timetravel')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'timetravel'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-800'
            }`}
          >
            Time Travel
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'notifications'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-800'
            }`}
          >
            Notifications
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {activeTab === 'timeline' && <AuditTimeline sessionId={sessionId} />}
        {activeTab === 'nodes' && <BulkNodeActions sessionId={sessionId} />}
        {activeTab === 'timetravel' && <TimeTravelView sessionId={sessionId} />}
        {activeTab === 'notifications' && <NotificationSettings sessionId={sessionId} />}
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
