'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  BellIcon, BellSlashIcon, CheckCircleIcon,
  ExclamationTriangleIcon, PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import { useStore, NotificationPreferences } from '@/stores/useStore';

interface NotificationSettingsProps {
  sessionId: string;
}

const PREF_OPTIONS: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: 'notify_node_created', label: 'New requirements', description: 'When a requirement is added to the scope tree' },
  { key: 'notify_node_modified', label: 'Requirement edits', description: 'When a requirement question or answer is modified' },
  { key: 'notify_node_deleted', label: 'Requirement deletions', description: 'When a requirement is removed from the tree' },
  { key: 'notify_node_moved', label: 'Requirement moves', description: 'When a requirement is moved to a different parent' },
  { key: 'notify_status_changed', label: 'Status changes', description: 'When a requirement is deferred, completed, or reactivated' },
  { key: 'notify_source_ingested', label: 'New sources', description: 'When meeting notes or documents are ingested' },
  { key: 'notify_team_member_added', label: 'Team member added', description: 'When a new team member joins the project' },
];

export default function NotificationSettings({ sessionId }: NotificationSettingsProps) {
  const {
    notificationPreferences, notificationHealth, isLoadingNotifications,
    fetchNotificationPreferences, updateNotificationPreferences,
    fetchNotificationHealth, sendTestNotification,
  } = useStore();

  const [saving, setSaving] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  useEffect(() => {
    fetchNotificationPreferences(sessionId);
    fetchNotificationHealth();
  }, [sessionId, fetchNotificationPreferences, fetchNotificationHealth]);

  const handleToggle = useCallback(async (key: keyof NotificationPreferences) => {
    if (!notificationPreferences) return;
    setSaving(key);
    try {
      await updateNotificationPreferences(sessionId, {
        [key]: !notificationPreferences[key],
      });
    } catch {
      // error is logged in the store
    } finally {
      setSaving(null);
    }
  }, [notificationPreferences, sessionId, updateNotificationPreferences]);

  const handleToggleAll = useCallback(async (subscribe: boolean) => {
    setSaving('is_subscribed');
    try {
      await updateNotificationPreferences(sessionId, {
        is_subscribed: subscribe,
      });
    } catch {
      // handled
    } finally {
      setSaving(null);
    }
  }, [sessionId, updateNotificationPreferences]);

  const handleTestEmail = useCallback(async () => {
    setTestStatus('sending');
    try {
      const result = await sendTestNotification();
      setTestStatus(result.success ? 'success' : 'error');
    } catch {
      setTestStatus('error');
    }
    setTimeout(() => setTestStatus('idle'), 4000);
  }, [sendTestNotification]);

  const isConnected = notificationHealth?.status === 'ok';

  return (
    <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BellIcon className="h-5 w-5 text-neutral-900" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Email Notifications</h3>
            <p className="text-xs text-gray-500">Email notifications via SMTP</p>
          </div>
        </div>

        {/* Connection badge */}
        <div className="flex items-center gap-2">
          {notificationHealth && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                isConnected
                  ? 'bg-green-50 text-green-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              {isConnected ? (
                <CheckCircleIcon className="h-3.5 w-3.5" />
              ) : (
                <ExclamationTriangleIcon className="h-3.5 w-3.5" />
              )}
              {isConnected ? 'Connected' : notificationHealth.status}
            </span>
          )}
        </div>
      </div>

      {isLoadingNotifications || !notificationPreferences ? (
        <div className="px-6 py-8 text-center text-sm text-gray-400">Loading preferences…</div>
      ) : (
        <>
          {/* Master toggle */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {notificationPreferences.is_subscribed ? 'Notifications enabled' : 'Notifications paused'}
              </p>
              <p className="text-xs text-gray-500">
                {notificationPreferences.is_subscribed
                  ? 'You will receive emails for selected events'
                  : 'All email notifications are paused for this project'}
              </p>
            </div>
            <button
              onClick={() => handleToggleAll(!notificationPreferences.is_subscribed)}
              disabled={saving === 'is_subscribed'}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 ${
                notificationPreferences.is_subscribed ? 'bg-neutral-900' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  notificationPreferences.is_subscribed ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Individual toggles */}
          <div className={notificationPreferences.is_subscribed ? '' : 'opacity-50 pointer-events-none'}>
            <ul className="divide-y divide-gray-100">
              {PREF_OPTIONS.map((opt) => (
                <li key={opt.key} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-800">{opt.label}</p>
                    <p className="text-xs text-gray-400">{opt.description}</p>
                  </div>
                  <button
                    onClick={() => handleToggle(opt.key)}
                    disabled={saving === opt.key}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-1 ${
                      notificationPreferences[opt.key] ? 'bg-neutral-900' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        notificationPreferences[opt.key] ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer: test email */}
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Notifications are sent to your account email address
            </p>
            <button
              onClick={handleTestEmail}
              disabled={testStatus === 'sending' || !isConnected}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              {testStatus === 'sending' ? (
                <>
                  <span className="h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  Sending…
                </>
              ) : testStatus === 'success' ? (
                <>
                  <CheckCircleIcon className="h-3.5 w-3.5 text-green-500" />
                  Sent!
                </>
              ) : testStatus === 'error' ? (
                <>
                  <ExclamationTriangleIcon className="h-3.5 w-3.5 text-red-500" />
                  Failed
                </>
              ) : (
                <>
                  <PaperAirplaneIcon className="h-3.5 w-3.5" />
                  Send test email
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
