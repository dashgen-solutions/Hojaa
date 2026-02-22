'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  PlusCircleIcon, PencilSquareIcon, AdjustmentsHorizontalIcon,
  ArrowsRightLeftIcon, TrashIcon, ClockIcon,
  ArrowUturnLeftIcon, ArrowsPointingOutIcon,
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
  const { nodeHistory, fetchNodeHistory, revertNodeVersion, compareVersions } = useStore();
  const historyEntries = nodeHistory[nodeId] || [];
  const [isReverting, setIsReverting] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [comparisonResult, setComparisonResult] = useState<any>(null);

  useEffect(() => {
    fetchNodeHistory(nodeId);
  }, [nodeId, fetchNodeHistory]);

  const handleRevert = useCallback(async (entryId: string) => {
    if (!confirm('Revert this node to its previous value? This will create a new audit entry.')) return;
    setIsReverting(true);
    try {
      await revertNodeVersion(nodeId, entryId);
      await fetchNodeHistory(nodeId);
    } catch (error: any) {
      alert(error?.response?.data?.detail || 'Failed to revert');
    } finally {
      setIsReverting(false);
    }
  }, [nodeId, revertNodeVersion, fetchNodeHistory]);

  const toggleCompareSelection = useCallback((entryId: string) => {
    setCompareSelection((prev) => {
      if (prev.includes(entryId)) return prev.filter((id) => id !== entryId);
      if (prev.length >= 2) return [prev[1], entryId];
      return [...prev, entryId];
    });
    setComparisonResult(null);
  }, []);

  const handleCompare = useCallback(async () => {
    if (compareSelection.length !== 2) return;
    try {
      const result = await compareVersions(nodeId, compareSelection[0], compareSelection[1]);
      setComparisonResult(result);
    } catch (error: any) {
      alert(error?.response?.data?.detail || 'Failed to compare');
    }
  }, [nodeId, compareSelection, compareVersions]);

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow border-l border-neutral-200 z-50 flex flex-col">
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

        {/* Compare toolbar */}
        {compareSelection.length > 0 && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-neutral-500">
              {compareSelection.length}/2 selected
            </span>
            {compareSelection.length === 2 && (
              <button
                onClick={handleCompare}
                className="px-2.5 py-1 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 transition-colors flex items-center gap-1"
              >
                <ArrowsPointingOutIcon className="w-3 h-3" />
                Compare
              </button>
            )}
            <button
              onClick={() => { setCompareSelection([]); setComparisonResult(null); }}
              className="px-2 py-1 text-neutral-500 hover:text-neutral-700"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Side-by-side comparison result */}
      {comparisonResult && (
        <div className="px-5 py-3 border-b border-neutral-200 bg-neutral-50 text-xs space-y-2 animate-fade-in">
          <div className="font-medium text-neutral-700 mb-1">Version Comparison</div>
          <div className="grid grid-cols-2 gap-2">
            {/* Version A */}
            <div className="bg-white rounded-md p-2 border border-neutral-200">
              <div className="font-medium text-neutral-600 mb-1">Version A</div>
              <div className="text-[10px] text-neutral-400 mb-1">
                {new Date(comparisonResult.version_a.changed_at).toLocaleString()}
              </div>
              {comparisonResult.version_a.field_changed && (
                <p className="text-neutral-600">
                  <span className="font-medium">{comparisonResult.version_a.field_changed}:</span>{' '}
                  <span className="text-red-500">{comparisonResult.version_a.old_value || '—'}</span>
                  {' → '}
                  <span className="text-green-600">{comparisonResult.version_a.new_value || '—'}</span>
                </p>
              )}
            </div>
            {/* Version B */}
            <div className="bg-white rounded-md p-2 border border-neutral-200">
              <div className="font-medium text-neutral-600 mb-1">Version B</div>
              <div className="text-[10px] text-neutral-400 mb-1">
                {new Date(comparisonResult.version_b.changed_at).toLocaleString()}
              </div>
              {comparisonResult.version_b.field_changed && (
                <p className="text-neutral-600">
                  <span className="font-medium">{comparisonResult.version_b.field_changed}:</span>{' '}
                  <span className="text-red-500">{comparisonResult.version_b.old_value || '—'}</span>
                  {' → '}
                  <span className="text-green-600">{comparisonResult.version_b.new_value || '—'}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

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

            {/* Compare hint */}
            <p className="text-[10px] text-neutral-400 mb-3 ml-10">
              Select two entries to compare side-by-side
            </p>

            <div className="space-y-4">
              {historyEntries.map((entry: NodeHistoryEntry) => {
                const config = CHANGE_TYPE_CONFIG[entry.change_type] || CHANGE_TYPE_CONFIG.modified;
                const EntryIcon = config.icon;
                const isSelected = compareSelection.includes(entry.id);
                const canRevert = entry.old_value !== null && entry.field_changed !== null;

                return (
                  <div key={entry.id} className="relative pl-10">
                    {/* Timeline dot / compare checkbox */}
                    <button
                      onClick={() => toggleCompareSelection(entry.id)}
                      className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-neutral-900 ring-2 ring-neutral-300'
                          : `${config.bgColor}`
                      }`}
                      title="Select for comparison"
                    >
                      {isSelected ? (
                        <span className="text-white text-[10px] font-bold">
                          {compareSelection.indexOf(entry.id) + 1}
                        </span>
                      ) : (
                        <EntryIcon className={`w-3 h-3 ${config.color}`} />
                      )}
                    </button>

                    <div className="bg-neutral-50 rounded-md p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                        <div className="flex items-center gap-1.5">
                          {/* Revert button */}
                          {canRevert && (
                            <button
                              onClick={() => handleRevert(entry.id)}
                              disabled={isReverting}
                              className="p-1 rounded hover:bg-neutral-200 text-neutral-400 hover:text-amber-600 transition-colors disabled:opacity-50"
                              title="Revert to this version's old value"
                            >
                              <ArrowUturnLeftIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <span className="text-[10px] text-neutral-400">
                            {new Date(entry.changed_at).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </div>
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
                          <span className="bg-neutral-200 px-1.5 py-0.5 rounded text-primary-500 font-medium cursor-pointer hover:underline">
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
