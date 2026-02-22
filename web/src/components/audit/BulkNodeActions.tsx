'use client';

import { useState, useEffect } from 'react';
import {
  CheckIcon, XMarkIcon, PauseCircleIcon, TrashIcon,
  ArrowPathIcon, FunnelIcon, CalendarDaysIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { useStore } from '@/stores/useStore';

interface FilteredNode {
  id: string;
  question: string;
  node_type: string;
  status: string;
  depth: number;
  source_id: string | null;
  updated_at: string;
}

interface BulkNodeActionsProps {
  sessionId: string;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-700', icon: CheckCircleIcon },
  { value: 'deferred', label: 'Deferred', color: 'bg-amber-100 text-amber-700', icon: PauseCircleIcon },
  { value: 'completed', label: 'Completed', color: 'bg-blue-100 text-blue-700', icon: CheckIcon },
  { value: 'removed', label: 'Removed', color: 'bg-red-100 text-red-700', icon: TrashIcon },
];

export default function BulkNodeActions({ sessionId }: BulkNodeActionsProps) {
  const { fetchFilteredNodes, bulkChangeNodeStatus, sources, fetchSources } = useStore();

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [nodeTypeFilter, setNodeTypeFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [sourceIdFilter, setSourceIdFilter] = useState<string>('');

  // Results and selection
  const [filteredNodes, setFilteredNodes] = useState<FilteredNode[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // Bulk action state
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [bulkReason, setBulkReason] = useState<string>('');
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  // Load sources for the filter dropdown
  useEffect(() => {
    fetchSources(sessionId);
  }, [sessionId, fetchSources]);

  const handleSearch = async () => {
    setIsLoading(true);
    setSelectedNodeIds(new Set());
    setResultMessage(null);
    try {
      const filters: Record<string, string> = {};
      if (statusFilter) filters.status = statusFilter;
      if (nodeTypeFilter) filters.nodeType = nodeTypeFilter;
      if (dateFrom) filters.dateFrom = new Date(dateFrom).toISOString();
      if (dateTo) filters.dateTo = new Date(dateTo).toISOString();
      if (sourceIdFilter) filters.sourceId = sourceIdFilter;

      const nodes = await fetchFilteredNodes(sessionId, filters);
      setFilteredNodes(nodes || []);
    } catch {
      setFilteredNodes([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load all nodes on mount
  useEffect(() => {
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const toggleNodeSelection = (nodeId: string) => {
    setSelectedNodeIds((previous) => {
      const updated = new Set(previous);
      if (updated.has(nodeId)) {
        updated.delete(nodeId);
      } else {
        updated.add(nodeId);
      }
      return updated;
    });
  };

  const toggleSelectAll = () => {
    if (selectedNodeIds.size === filteredNodes.length) {
      setSelectedNodeIds(new Set());
    } else {
      setSelectedNodeIds(new Set(filteredNodes.map((node) => node.id)));
    }
  };

  const handleBulkApply = async () => {
    if (!bulkStatus || selectedNodeIds.size === 0) return;
    setIsApplying(true);
    setResultMessage(null);
    try {
      const result = await bulkChangeNodeStatus(
        Array.from(selectedNodeIds),
        bulkStatus,
        bulkReason || undefined,
      );
      setResultMessage(result.message || `Updated ${result.updated_count} nodes`);
      setSelectedNodeIds(new Set());
      setShowBulkPanel(false);
      setBulkStatus('');
      setBulkReason('');
      // Refresh the list
      await handleSearch();
    } catch {
      setResultMessage('Failed to update nodes');
    } finally {
      setIsApplying(false);
    }
  };

  const allSelected = filteredNodes.length > 0 && selectedNodeIds.size === filteredNodes.length;

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white rounded-md border border-neutral-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <FunnelIcon className="w-4 h-4 text-neutral-500" />
          <h3 className="text-sm font-semibold text-neutral-800">Filter Nodes</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="px-3 py-1.5 rounded-md border border-neutral-300 text-sm focus:border-neutral-400 outline-none"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          {/* Node type filter */}
          <select
            value={nodeTypeFilter}
            onChange={(event) => setNodeTypeFilter(event.target.value)}
            className="px-3 py-1.5 rounded-md border border-neutral-300 text-sm focus:border-neutral-400 outline-none"
          >
            <option value="">All types</option>
            <option value="root">Root</option>
            <option value="feature">Feature</option>
            <option value="detail">Detail</option>
          </select>

          {/* Date from */}
          <div className="relative">
            <CalendarDaysIcon className="w-4 h-4 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="w-full pl-8 pr-2 py-1.5 rounded-md border border-neutral-300 text-sm focus:border-neutral-400 outline-none"
              placeholder="From date"
            />
          </div>

          {/* Date to */}
          <div className="relative">
            <CalendarDaysIcon className="w-4 h-4 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="w-full pl-8 pr-2 py-1.5 rounded-md border border-neutral-300 text-sm focus:border-neutral-400 outline-none"
              placeholder="To date"
            />
          </div>

          {/* Source filter */}
          <select
            value={sourceIdFilter}
            onChange={(event) => setSourceIdFilter(event.target.value)}
            className="px-3 py-1.5 rounded-md border border-neutral-300 text-sm focus:border-neutral-400 outline-none"
          >
            <option value="">All sources</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>{source.source_name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={handleSearch}
            disabled={isLoading}
            className="px-4 py-1.5 rounded-md bg-neutral-900 text-white text-sm font-medium
                       hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {isLoading ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <ArrowPathIcon className="w-3.5 h-3.5" />
            )}
            Search
          </button>
          <span className="text-xs text-neutral-500">
            {filteredNodes.length} node{filteredNodes.length !== 1 ? 's' : ''} found
          </span>
        </div>
      </div>

      {/* Result message */}
      {resultMessage && (
        <div className="bg-green-50 border border-green-200 rounded-md px-4 py-2 text-sm text-green-700 flex items-center justify-between">
          <span>{resultMessage}</span>
          <button onClick={() => setResultMessage(null)} className="text-green-500 hover:text-green-700">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Selection bar + bulk actions */}
      {filteredNodes.length > 0 && (
        <div className="bg-white rounded-md border border-neutral-200 overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-100 bg-neutral-50">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400"
                />
                <span className="text-xs text-neutral-600">
                  {selectedNodeIds.size > 0
                    ? `${selectedNodeIds.size} selected`
                    : 'Select all'}
                </span>
              </label>
            </div>

            {selectedNodeIds.size > 0 && (
              <button
                onClick={() => setShowBulkPanel(!showBulkPanel)}
                className="px-3 py-1 rounded-md bg-neutral-900 text-white text-xs font-medium
                           hover:bg-neutral-800 transition-colors"
              >
                Bulk Change Status
              </button>
            )}
          </div>

          {/* Bulk action panel */}
          {showBulkPanel && selectedNodeIds.size > 0 && (
            <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200 flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-neutral-700 mb-1">New Status</label>
                <select
                  value={bulkStatus}
                  onChange={(event) => setBulkStatus(event.target.value)}
                  className="w-full px-3 py-1.5 rounded-md border border-neutral-300 text-sm focus:border-neutral-400 outline-none"
                >
                  <option value="">Select status...</option>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-neutral-700 mb-1">Reason (optional)</label>
                <input
                  type="text"
                  value={bulkReason}
                  onChange={(event) => setBulkReason(event.target.value)}
                  className="w-full px-3 py-1.5 rounded-md border border-neutral-300 text-sm focus:border-neutral-400 outline-none"
                  placeholder="Why are you changing these?"
                />
              </div>
              <button
                onClick={handleBulkApply}
                disabled={!bulkStatus || isApplying}
                className="px-4 py-1.5 rounded-md bg-neutral-900 text-white text-sm font-medium
                           hover:bg-neutral-800 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {isApplying ? 'Applying...' : `Apply to ${selectedNodeIds.size}`}
              </button>
            </div>
          )}

          {/* Node list */}
          <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100">
            {filteredNodes.map((node) => {
              const isSelected = selectedNodeIds.has(node.id);
              const statusConfig = STATUS_OPTIONS.find((option) => option.value === node.status);

              return (
                <div
                  key={node.id}
                  className={`flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 transition-colors ${
                    isSelected ? 'bg-neutral-50/50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleNodeSelection(node.id)}
                    className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-800 truncate">{node.question}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600">
                        {node.node_type}
                      </span>
                      {statusConfig && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusConfig.color}`}>
                          {statusConfig.label}
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
  );
}
