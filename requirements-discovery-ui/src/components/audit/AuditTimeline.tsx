'use client';

import { useEffect, useState } from 'react';
import {
  PlusCircleIcon, PencilSquareIcon, ArrowsRightLeftIcon,
  TrashIcon, AdjustmentsHorizontalIcon, FunnelIcon,
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
  const { auditEntries, auditTotalChanges, isLoadingAudit, fetchTimeline } = useStore();
  const [timeRange, setTimeRange] = useState(30);
  const [changeTypeFilter, setChangeTypeFilter] = useState<string | null>(null);

  useEffect(() => {
    fetchTimeline(sessionId, timeRange);
  }, [sessionId, timeRange, fetchTimeline]);

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
        <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Change History</h2>
          <p className="text-sm text-neutral-500 mt-1">{auditTotalChanges} total changes recorded</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Time range selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className="px-3 py-1.5 rounded-lg border border-neutral-300 text-sm 
                       focus:border-primary-500 outline-none"
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
              className="pl-8 pr-3 py-1.5 rounded-lg border border-neutral-300 text-sm 
                         focus:border-primary-500 outline-none appearance-none"
            >
              <option value="">All changes</option>
              {Object.entries(CHANGE_TYPE_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
            <FunnelIcon className="w-4 h-4 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
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
                <div className="h-px flex-1 bg-neutral-200" />
                <span className="text-xs font-medium text-neutral-500 whitespace-nowrap">{dateLabel}</span>
                <div className="h-px flex-1 bg-neutral-200" />
              </div>

              {/* Entries for this date */}
              <div className="space-y-2">
                {entries.map((entry) => {
                  const config = CHANGE_TYPE_CONFIG[entry.change_type] || CHANGE_TYPE_CONFIG.modified;
                  const EntryIcon = config.icon;

                  return (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-neutral-50 transition-colors"
                    >
                      {/* Icon */}
                      <div className={`w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center shrink-0`}>
                        <EntryIcon className={`w-4 h-4 ${config.color}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-sm font-medium text-neutral-900">{entry.node_title}</span>
                            <span className={`ml-2 text-xs font-medium ${config.color}`}>{config.label}</span>
                          </div>
                          <span className="text-[10px] text-neutral-400 whitespace-nowrap">
                            {new Date(entry.changed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Change details */}
                        {entry.field_changed && (
                          <p className="text-xs text-neutral-600 mt-0.5">
                            <span className="font-medium">{entry.field_changed}</span>
                            {entry.old_value && entry.new_value && (
                              <span>: {entry.old_value} → {entry.new_value}</span>
                            )}
                          </p>
                        )}

                        {entry.change_reason && (
                          <p className="text-xs text-neutral-500 mt-0.5 italic">
                            &ldquo;{entry.change_reason}&rdquo;
                          </p>
                        )}

                        {/* Attribution */}
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-neutral-400">
                          {entry.changed_by_name && <span>by {entry.changed_by_name}</span>}
                          {entry.source_name && <span>from {entry.source_name}</span>}
                        </div>
                      </div>
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
