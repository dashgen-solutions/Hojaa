'use client';

import { useState } from 'react';
import {
  ClockIcon, ArrowsRightLeftIcon, PlusCircleIcon,
  TrashIcon, PencilSquareIcon, PauseCircleIcon,
  AdjustmentsHorizontalIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline';
import {
  useStore,
  GraphSnapshotNode,
  ComparisonChangeEntry,
} from '@/stores/useStore';

interface TimeTravelViewProps {
  sessionId: string;
}

// ===== Status Badge Colors =====

const STATUS_STYLES: Record<string, { text: string; bg: string; dot: string }> = {
  active: { text: 'text-green-700', bg: 'bg-green-50', dot: 'bg-green-500' },
  deferred: { text: 'text-amber-700', bg: 'bg-amber-50', dot: 'bg-amber-500' },
  completed: { text: 'text-blue-700', bg: 'bg-blue-50', dot: 'bg-blue-500' },
  removed: { text: 'text-red-700', bg: 'bg-red-50', dot: 'bg-red-500' },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.active;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${style.text} ${style.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {status}
    </span>
  );
}

// ===== Node Type Badge =====

function NodeTypeBadge({ nodeType }: { nodeType: string }) {
  return (
    <span className="text-[10px] font-medium text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
      {nodeType}
    </span>
  );
}

// ===== Graph Snapshot Sub-View =====

function SnapshotView({ sessionId }: { sessionId: string }) {
  const { graphSnapshot, isLoadingTimeTravel, fetchGraphSnapshot } = useStore();
  const [selectedDate, setSelectedDate] = useState('');

  const handleLoadSnapshot = () => {
    if (!selectedDate) return;
    // Convert the date input to end-of-day ISO format
    const endOfDayDate = new Date(selectedDate + 'T23:59:59');
    fetchGraphSnapshot(sessionId, endOfDayDate.toISOString());
  };

  // Build a simple tree from the flat node list
  const buildTreeFromNodes = (flatNodes: GraphSnapshotNode[]) => {
    const nodeMap = new Map<string, GraphSnapshotNode & { children: GraphSnapshotNode[] }>();
    const rootNodes: (GraphSnapshotNode & { children: GraphSnapshotNode[] })[] = [];

    // Initialize all nodes with empty children
    for (const node of flatNodes) {
      nodeMap.set(node.id, { ...node, children: [] });
    }

    // Link children to parents
    for (const node of flatNodes) {
      const treeNode = nodeMap.get(node.id)!;
      if (node.parent_id && nodeMap.has(node.parent_id)) {
        nodeMap.get(node.parent_id)!.children.push(treeNode);
      } else {
        rootNodes.push(treeNode);
      }
    }

    return rootNodes;
  };

  const renderTreeNode = (
    node: GraphSnapshotNode & { children: GraphSnapshotNode[] },
    indentLevel: number = 0,
  ): JSX.Element => {
    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-neutral-50"
          style={{ paddingLeft: `${12 + indentLevel * 20}px` }}
        >
          {node.children.length > 0 && (
            <ChevronRightIcon className="w-3 h-3 text-neutral-400" />
          )}
          <span className="text-sm text-neutral-800 flex-1 truncate">{node.title}</span>
          <NodeTypeBadge nodeType={node.node_type} />
          <StatusBadge status={node.status} />
        </div>
        {node.children.map((child: any) => renderTreeNode(child, indentLevel + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Date picker and action */}
      <div className="flex items-end gap-4 p-4 bg-white rounded-md border border-neutral-200">
        <div className="flex-1">
          <label className="block text-xs font-medium text-neutral-600 mb-1">
            View graph as of date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="w-full px-3 py-2 rounded-md border border-neutral-300 text-sm
                       focus:border-neutral-400 focus:ring-1 focus:ring-neutral-200 outline-none"
          />
        </div>
        <button
          onClick={handleLoadSnapshot}
          disabled={!selectedDate || isLoadingTimeTravel}
          className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-md
                     hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          {isLoadingTimeTravel ? 'Loading...' : 'Load Snapshot'}
        </button>
      </div>

      {/* Snapshot Results */}
      {graphSnapshot && (
        <div className="bg-white rounded-md border border-neutral-200 overflow-hidden">
          {/* Summary bar */}
          <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClockIcon className="w-4 h-4 text-neutral-900" />
                <span className="text-sm font-semibold text-neutral-900">
                  Graph Snapshot
                </span>
                <span className="text-xs text-neutral-500">
                  as of {new Date(graphSnapshot.as_of_date).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric',
                  })}
                </span>
              </div>
              <span className="text-xs font-medium text-neutral-600">
                {graphSnapshot.total_nodes} node{graphSnapshot.total_nodes !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Status count pills */}
            <div className="flex gap-2 mt-2">
              {Object.entries(graphSnapshot.status_counts).map(([status, count]) => (
                <span
                  key={status}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium
                    ${STATUS_STYLES[status]?.text || 'text-neutral-600'}
                    ${STATUS_STYLES[status]?.bg || 'bg-neutral-100'}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_STYLES[status]?.dot || 'bg-neutral-400'}`} />
                  {count} {status}
                </span>
              ))}
            </div>
          </div>

          {/* Tree rendering */}
          <div className="p-2 max-h-[500px] overflow-y-auto">
            {graphSnapshot.nodes.length === 0 ? (
              <div className="text-center py-10 text-neutral-400 text-sm">
                No nodes existed at this date.
              </div>
            ) : (
              buildTreeFromNodes(graphSnapshot.nodes).map((rootNode) =>
                renderTreeNode(rootNode, 0)
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Comparison Sub-View =====

const DIFF_CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string; bgColor: string; borderColor: string }> = {
  added: { label: 'Added', icon: PlusCircleIcon, color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
  removed: { label: 'Removed', icon: TrashIcon, color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  modified: { label: 'Modified', icon: PencilSquareIcon, color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  deferred: { label: 'Deferred', icon: PauseCircleIcon, color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  status_changes: { label: 'Status Changes', icon: AdjustmentsHorizontalIcon, color: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
};

function ComparisonView({ sessionId }: { sessionId: string }) {
  const { graphComparison, isLoadingTimeTravel, fetchGraphComparison } = useStore();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const handleCompare = () => {
    if (!dateFrom || !dateTo) return;
    const startDate = new Date(dateFrom + 'T00:00:00');
    const endDate = new Date(dateTo + 'T23:59:59');
    fetchGraphComparison(sessionId, startDate.toISOString(), endDate.toISOString());
  };

  const renderChangeList = (
    categoryKey: string,
    entries: ComparisonChangeEntry[],
  ) => {
    if (entries.length === 0) return null;
    const config = DIFF_CATEGORY_CONFIG[categoryKey];
    const CategoryIcon = config.icon;

    return (
      <div key={categoryKey} className={`rounded-md border ${config.borderColor} overflow-hidden`}>
        {/* Category header */}
        <div className={`flex items-center gap-2 px-4 py-2.5 ${config.bgColor}`}>
          <CategoryIcon className={`w-4 h-4 ${config.color}`} />
          <span className={`text-sm font-semibold ${config.color}`}>
            {config.label}
          </span>
          <span className={`ml-auto text-xs font-medium ${config.color}`}>
            {entries.length}
          </span>
        </div>

        {/* Entries */}
        <div className="divide-y divide-neutral-100">
          {entries.map((entry, entryIndex) => (
            <div key={`${entry.node_id}-${entryIndex}`} className="px-4 py-2.5 bg-white">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-neutral-800">{entry.title}</span>
                {entry.node_type && <NodeTypeBadge nodeType={entry.node_type} />}
              </div>

              {/* Show field change detail for modifications */}
              {entry.field_changed && (
                <p className="text-xs text-neutral-600 mt-1">
                  <span className="font-medium">{entry.field_changed}:</span>{' '}
                  {entry.old_value && (
                    <span className="line-through text-red-500 mr-1">{entry.old_value}</span>
                  )}
                  {entry.new_value && (
                    <span className="text-green-600">{entry.new_value}</span>
                  )}
                </p>
              )}

              {/* Show status change for status entries */}
              {entry.old_value && entry.new_value && !entry.field_changed && (
                <p className="text-xs text-neutral-600 mt-1">
                  <StatusBadge status={entry.old_value} />
                  <span className="mx-1.5 text-neutral-400">→</span>
                  <StatusBadge status={entry.new_value} />
                </p>
              )}

              {entry.reason && (
                <p className="text-xs text-neutral-500 mt-1 italic">&ldquo;{entry.reason}&rdquo;</p>
              )}

              {entry.changed_at && (
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  {new Date(entry.changed_at).toLocaleString('en-US', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Date range picker */}
      <div className="flex items-end gap-4 p-4 bg-white rounded-md border border-neutral-200">
        <div className="flex-1">
          <label className="block text-xs font-medium text-neutral-600 mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="w-full px-3 py-2 rounded-md border border-neutral-300 text-sm
                       focus:border-neutral-400 focus:ring-1 focus:ring-neutral-200 outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-neutral-600 mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="w-full px-3 py-2 rounded-md border border-neutral-300 text-sm
                       focus:border-neutral-400 focus:ring-1 focus:ring-neutral-200 outline-none"
          />
        </div>
        <button
          onClick={handleCompare}
          disabled={!dateFrom || !dateTo || isLoadingTimeTravel}
          className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-md
                     hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors whitespace-nowrap"
        >
          {isLoadingTimeTravel ? 'Comparing...' : 'Compare'}
        </button>
      </div>

      {/* Comparison Results */}
      {graphComparison && (
        <div className="space-y-5">
          {/* Summary cards row */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Added', count: graphComparison.summary.added_count, color: 'text-green-700', bg: 'bg-green-50' },
              { label: 'Removed', count: graphComparison.summary.removed_count, color: 'text-red-700', bg: 'bg-red-50' },
              { label: 'Modified', count: graphComparison.summary.modified_count, color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'Deferred', count: graphComparison.summary.deferred_count, color: 'text-amber-700', bg: 'bg-amber-50' },
              { label: 'Status', count: graphComparison.summary.status_changes_count, color: 'text-purple-700', bg: 'bg-purple-50' },
            ].map((item) => (
              <div key={item.label} className={`${item.bg} rounded-md p-3 text-center`}>
                <div className={`text-xl font-bold ${item.color}`}>{item.count}</div>
                <div className={`text-[10px] font-medium ${item.color} mt-0.5`}>{item.label}</div>
              </div>
            ))}
          </div>

          {/* No changes state */}
          {graphComparison.summary.total_changes === 0 && (
            <div className="text-center py-12 text-neutral-400">
              <ArrowsRightLeftIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No changes between these dates.</p>
            </div>
          )}

          {/* Diff categories */}
          {renderChangeList('added', graphComparison.added)}
          {renderChangeList('removed', graphComparison.removed)}
          {renderChangeList('modified', graphComparison.modified)}
          {renderChangeList('deferred', graphComparison.deferred)}
          {renderChangeList('status_changes', graphComparison.status_changes)}
        </div>
      )}
    </div>
  );
}

// ===== Main Time-Travel View =====

export default function TimeTravelView({ sessionId }: TimeTravelViewProps) {
  const [subTab, setSubTab] = useState<'snapshot' | 'compare'>('snapshot');
  const { clearTimeTravel } = useStore();

  const handleTabChange = (tab: 'snapshot' | 'compare') => {
    clearTimeTravel();
    setSubTab(tab);
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-neutral-900">Time Travel</h2>
        <p className="text-sm text-neutral-500 mt-1">
          View past states of the graph or compare changes between two dates.
        </p>
      </div>

      {/* Sub-tabs: Snapshot vs Compare */}
      <div className="flex gap-1 bg-neutral-200/60 rounded-md p-0.5 w-fit mb-6">
        <button
          onClick={() => handleTabChange('snapshot')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            subTab === 'snapshot'
              ? 'bg-white text-neutral-900 shadow-sm'
              : 'text-neutral-600 hover:text-neutral-800'
          }`}
        >
          <ClockIcon className="w-4 h-4" />
          Graph Snapshot
        </button>
        <button
          onClick={() => handleTabChange('compare')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            subTab === 'compare'
              ? 'bg-white text-neutral-900 shadow-sm'
              : 'text-neutral-600 hover:text-neutral-800'
          }`}
        >
          <ArrowsRightLeftIcon className="w-4 h-4" />
          Compare Changes
        </button>
      </div>

      {/* Sub-view content */}
      {subTab === 'snapshot' && <SnapshotView sessionId={sessionId} />}
      {subTab === 'compare' && <ComparisonView sessionId={sessionId} />}
    </div>
  );
}
