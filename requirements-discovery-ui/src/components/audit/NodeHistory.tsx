'use client';

import { useEffect } from 'react';
import {
  PlusCircleIcon, PencilSquareIcon, AdjustmentsHorizontalIcon,
  ArrowsRightLeftIcon, TrashIcon, ClockIcon,
} from '@heroicons/react/24/outline';
import { useStore, NodeHistoryEntry } from '@/stores/useStore';

interface NodeHistoryProps {
  nodeId: string;
  nodeTitle: string;
  onClose: () => void;
}

const CHANGE_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  created: { label: 'Created', icon: PlusCircleIcon, color: 'text-green-600', bgColor: 'bg-green-100' },
  modified: { label: 'Modified', icon: PencilSquareIcon, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  status_changed: { label: 'Status Changed', icon: AdjustmentsHorizontalIcon, color: 'text-amber-600', bgColor: 'bg-amber-100' },
  moved: { label: 'Moved', icon: ArrowsRightLeftIcon, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  deleted: { label: 'Deleted', icon: TrashIcon, color: 'text-red-600', bgColor: 'bg-red-100' },
};

export default function NodeHistoryPanel({ nodeId, nodeTitle, onClose }: NodeHistoryProps) {
  const { nodeHistory, fetchNodeHistory } = useStore();
  const historyEntries = nodeHistory[nodeId] || [];

  useEffect(() => {
    fetchNodeHistory(nodeId);
  }, [nodeId, fetchNodeHistory]);

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-neutral-200 z-50 flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Node History</h3>
            <p className="text-xs text-neutral-500 mt-0.5 truncate">{nodeTitle}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-neutral-100">
            <span className="sr-only">Close</span>
            <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* History Timeline */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {historyEntries.length === 0 ? (
          <div className="text-center py-12 text-neutral-400">
            <ClockIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No history recorded yet.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-neutral-200" />

            <div className="space-y-4">
              {historyEntries.map((entry: NodeHistoryEntry) => {
                const config = CHANGE_TYPE_CONFIG[entry.change_type] || CHANGE_TYPE_CONFIG.modified;
                const EntryIcon = config.icon;

                return (
                  <div key={entry.id} className="relative pl-10">
                    {/* Timeline dot */}
                    <div className={`absolute left-2 w-5 h-5 rounded-full ${config.bgColor} flex items-center justify-center`}>
                      <EntryIcon className={`w-3 h-3 ${config.color}`} />
                    </div>

                    <div className="bg-neutral-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                        <span className="text-[10px] text-neutral-400">
                          {new Date(entry.changed_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {entry.field_changed && (
                        <p className="text-xs text-neutral-700">
                          <span className="font-medium">{entry.field_changed}</span>
                          {entry.old_value && (
                            <span className="text-red-500 line-through ml-1">{entry.old_value}</span>
                          )}
                          {entry.new_value && (
                            <span className="text-green-600 ml-1">{entry.new_value}</span>
                          )}
                        </p>
                      )}

                      {entry.change_reason && (
                        <p className="text-xs text-neutral-500 mt-1 italic">&ldquo;{entry.change_reason}&rdquo;</p>
                      )}

                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-neutral-400">
                        {entry.changed_by_name && <span>by {entry.changed_by_name}</span>}
                        {entry.source_name && (
                          <span className="bg-neutral-200 px-1.5 py-0.5 rounded text-neutral-600">
                            {entry.source_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
