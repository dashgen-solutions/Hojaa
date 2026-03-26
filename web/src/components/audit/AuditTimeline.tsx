'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  PlusCircleIcon, PencilSquareIcon, ArrowsRightLeftIcon,
  TrashIcon, AdjustmentsHorizontalIcon, FunnelIcon,
  ChevronDownIcon, ChevronRightIcon, ArrowDownTrayIcon,
  UserIcon, DocumentTextIcon, DocumentArrowDownIcon,
} from '@heroicons/react/24/outline';
import { useStore, AuditEntry } from '@/stores/useStore';

interface AuditTimelineProps {
  sessionId: string;
}

const CHANGE_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  created: { label: 'Created', icon: PlusCircleIcon, color: 'text-green-600', bgColor: 'bg-green-100' },
  modified: { label: 'Modified', icon: PencilSquareIcon, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  status_changed: { label: 'Status Changed', icon: AdjustmentsHorizontalIcon, color: 'text-amber-600', bgColor: 'bg-amber-100' },
  moved: { label: 'Moved', icon: ArrowsRightLeftIcon, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  deleted: { label: 'Deleted', icon: TrashIcon, color: 'text-red-600', bgColor: 'bg-red-100' },
};

const TIME_RANGE_OPTIONS = [
  { value: 7, label: 'Last 7 days' },
  { value: 14, label: 'Last 14 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
  { value: 365, label: 'All time' },
];

export default function AuditTimeline({ sessionId }: AuditTimelineProps) {
  const {
    auditEntries, auditTotalChanges, isLoadingAudit,
    fetchTimeline, sessionUsers, fetchSessionUsers, exportAuditReport, exportAuditReportPdf,
  } = useStore();
  const [timeRange, setTimeRange] = useState(30);
  const [changeTypeFilter, setChangeTypeFilter] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState<string | null>(null);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExportMenu]);

  useEffect(() => {
    fetchSessionUsers(sessionId);
  }, [sessionId, fetchSessionUsers]);

  useEffect(() => {
    fetchTimeline(sessionId, timeRange, userFilter || undefined);
  }, [sessionId, timeRange, userFilter, fetchTimeline]);

  const toggleEntry = useCallback((entryId: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }, []);

  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async (format: 'markdown' | 'pdf') => {
    setShowExportMenu(false);
    setIsExporting(true);
    setExportError(null);
    try {
      if (format === 'pdf') {
        const blob = await exportAuditReportPdf(sessionId, undefined, undefined, userFilter || undefined);
        if (blob.type && blob.type.includes('application/json')) {
          const text = await blob.text();
          try { const err = JSON.parse(text); setExportError(err.detail || 'Export failed'); } catch { setExportError('Export failed'); }
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-report-${sessionId.slice(0, 8)}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const blob = await exportAuditReport(sessionId, undefined, undefined, userFilter || undefined);
        if (blob.type && blob.type.includes('application/json')) {
          const text = await blob.text();
          try { const err = JSON.parse(text); setExportError(err.detail || 'Export failed'); } catch { setExportError('Export failed'); }
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-report-${sessionId.slice(0, 8)}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      console.error('Export failed:', err);
      let msg = 'Export failed. Please try again.';
      if (err?.response?.data instanceof Blob) {
        try { const text = await err.response.data.text(); const parsed = JSON.parse(text); msg = parsed.detail || msg; } catch {}
      } else if (err?.response?.data?.detail) {
        msg = err.response.data.detail;
      } else if (err?.message) {
        msg = err.message;
      }
      setExportError(msg);
    } finally {
      setIsExporting(false);
    }
  };

  const filteredEntries = changeTypeFilter
    ? auditEntries.filter((entry) => entry.change_type === changeTypeFilter)
    : auditEntries;

  // Group entries by date
  const groupedByDate = filteredEntries.reduce<Record<string, AuditEntry[]>>((groups, entry) => {
    const dateKey = new Date(entry.changed_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(entry);
    return groups;
  }, {});

  if (isLoadingAudit) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-neutral-200 border-t-neutral-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Change History</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{auditTotalChanges} total changes recorded</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Export dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-lime text-brand-dark
                         hover:bg-brand-lime/90 shadow-sm hover:shadow-[0_0_16px_-4px_rgba(228,255,26,0.4)] transition-colors text-sm font-medium disabled:opacity-50"
              title="Export audit report"
            >
              {isExporting ? (
                <div className="w-4 h-4 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
              ) : (
                <ArrowDownTrayIcon className="w-4 h-4" />
              )}
              Export
              <ChevronDownIcon className="w-3 h-3" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-neutral-800 rounded-md shadow border
                              border-neutral-200 dark:border-neutral-700 py-1 z-20">
                <button
                  onClick={() => handleExport('pdf')}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300
                             hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                >
                  <DocumentArrowDownIcon className="w-4 h-4 text-red-500" />
                  Download PDF
                </button>
                <button
                  onClick={() => handleExport('markdown')}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300
                             hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                >
                  <DocumentTextIcon className="w-4 h-4 text-blue-500" />
                  Download Markdown
                </button>
              </div>
            )}
          </div>

          {/* User filter */}
          {sessionUsers.length > 0 && (
            <div className="relative">
              <select
                value={userFilter || ''}
                onChange={(e) => setUserFilter(e.target.value || null)}
                className="pl-8 pr-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-600 text-sm bg-white dark:bg-neutral-800 dark:text-neutral-300
                           focus:border-neutral-400 outline-none appearance-none"
              >
                <option value="">All users</option>
                {sessionUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.username}</option>
                ))}
              </select>
              <UserIcon className="w-4 h-4 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {/* Time range selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className="px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-600 text-sm bg-white dark:bg-neutral-800 dark:text-neutral-300
                       focus:border-neutral-400 outline-none"
          >
            {TIME_RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          {/* Change type filter */}
          <div className="relative">
            <select
              value={changeTypeFilter || ''}
              onChange={(e) => setChangeTypeFilter(e.target.value || null)}
              className={`pl-8 pr-3 py-1.5 rounded-md border text-sm outline-none appearance-none ${
                changeTypeFilter
                  ? 'border-[#E4FF1A] bg-brand-lime/10 text-brand-dark dark:text-[#E4FF1A]'
                  : 'border-neutral-300 dark:border-neutral-600 focus:border-neutral-400'
              }`}
            >
              <option value="">All changes</option>
              {Object.entries(CHANGE_TYPE_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
            <FunnelIcon className="w-4 h-4 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {exportError && (
            <p className="mt-2 text-xs text-red-500 dark:text-red-400">{exportError}</p>
          )}
        </div>
      </div>

      {/* Timeline */}
      {Object.keys(groupedByDate).length === 0 ? (
        <div className="text-center py-16 text-neutral-400">
          <AdjustmentsHorizontalIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No changes recorded yet.</p>
          <p className="text-xs mt-1">Changes will appear here as the scope evolves.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedByDate).map(([dateLabel, entries]) => (
            <div key={dateLabel}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 whitespace-nowrap">{dateLabel}</span>
                <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
              </div>

              {/* Entries for this date */}
              <div className="space-y-2">
                {entries.map((entry) => {
                  const config = CHANGE_TYPE_CONFIG[entry.change_type] || CHANGE_TYPE_CONFIG.modified;
                  const EntryIcon = config.icon;
                  const isExpanded = expandedEntries.has(entry.id);
                  const hasDetails = entry.field_changed || entry.change_reason || entry.old_value || entry.new_value;

                  return (
                    <div
                      key={entry.id}
                      className="rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                    >
                      {/* Collapsed row */}
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer"
                        onClick={() => hasDetails && toggleEntry(entry.id)}
                      >
                        {/* Icon */}
                        <div className={`w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center shrink-0`}>
                          <EntryIcon className={`w-4 h-4 ${config.color}`} />
                        </div>

                        {/* Compact content */}
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{entry.node_title}</span>
                          <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                        </div>

                        {/* Time */}
                        <span className="text-[10px] text-neutral-400 whitespace-nowrap">
                          {new Date(entry.changed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>

                        {/* Expand chevron */}
                        {hasDetails && (
                          isExpanded
                            ? <ChevronDownIcon className="w-3.5 h-3.5 text-neutral-400" />
                            : <ChevronRightIcon className="w-3.5 h-3.5 text-neutral-400" />
                        )}
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="px-3 pb-3 ml-11 text-xs space-y-1.5 animate-fade-in">
                          {entry.field_changed && (
                            <p className="text-neutral-600 dark:text-neutral-400">
                              <span className="font-medium">{entry.field_changed}</span>
                              {entry.old_value && entry.new_value && (
                                <span>: <span className="text-red-500 line-through">{entry.old_value}</span> → <span className="text-green-600">{entry.new_value}</span></span>
                              )}
                            </p>
                          )}

                          {entry.change_reason && (
                            <p className="text-neutral-500 italic">
                              &ldquo;{entry.change_reason}&rdquo;
                            </p>
                          )}

                          {/* Attribution with clickable source */}
                          <div className="flex items-center gap-3 text-[10px] text-neutral-400">
                            {entry.changed_by_name && <span>by {entry.changed_by_name}</span>}
                            {entry.source_name && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Navigate to source detail — use source_id if available
                                  if ((entry as any).source_id) {
                                    window.location.hash = `source-${(entry as any).source_id}`;
                                  }
                                }}
                                className="text-neutral-700 hover:underline hover:text-neutral-900 font-medium"
                              >
                                from {entry.source_name}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
