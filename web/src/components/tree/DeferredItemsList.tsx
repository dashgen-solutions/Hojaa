'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ClockIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { getFilteredNodes, updateNodeStatus } from '@/lib/api';

interface DeferredNode {
  id: string;
  question: string;
  answer?: string;
  type: string;
  status: string;
  deferred_reason?: string;
  depth: number;
  created_at?: string;
  updated_at?: string;
}

interface DeferredItemsListProps {
  sessionId: string;
  onReactivated?: () => void;
}

export default function DeferredItemsList({ sessionId, onReactivated }: DeferredItemsListProps) {
  const [nodes, setNodes] = useState<DeferredNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [reactivating, setReactivating] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const fetchDeferred = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFilteredNodes(sessionId, { status: 'deferred' });
      setNodes(Array.isArray(data) ? data : data.nodes ?? []);
    } catch (err) {
      console.error('Failed to load deferred items', err);
      setNodes([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchDeferred();
  }, [fetchDeferred]);

  const handleReactivate = async (nodeId: string) => {
    setReactivating(nodeId);
    try {
      await updateNodeStatus(nodeId, 'active', 'Reactivated from deferred list');
      setSuccessId(nodeId);
      setTimeout(() => {
        setNodes((prev) => prev.filter((n) => n.id !== nodeId));
        setSuccessId(null);
        if (onReactivated) onReactivated();
      }, 600);
    } catch (err) {
      console.error('Failed to reactivate node', err);
      alert('Failed to reactivate item');
    } finally {
      setReactivating(null);
    }
  };

  const filtered = search.trim()
    ? nodes.filter(
        (n) =>
          n.question.toLowerCase().includes(search.toLowerCase()) ||
          (n.deferred_reason ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : nodes;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-neutral-500 dark:text-neutral-400 text-sm gap-2">
        <ArrowPathIcon className="w-4 h-4 animate-spin" />
        Loading deferred items...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClockIcon className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            Deferred Items ({nodes.length})
          </h3>
        </div>
        {nodes.length > 3 && (
          <div className="relative">
            <MagnifyingGlassIcon className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Filter..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 pr-2 py-1 text-xs border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 rounded-md w-40 focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 focus:border-transparent"
            />
          </div>
        )}
      </div>

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="text-center py-8 text-sm text-neutral-400 dark:text-neutral-500">
          <CheckCircleIcon className="w-8 h-8 mx-auto mb-2 text-emerald-300" />
          No deferred items — all requirements are active.
        </div>
      )}

      {/* Items */}
      {filtered.length > 0 && (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {filtered.map((node) => (
            <div
              key={node.id}
              className={`
                rounded-md border p-3 transition-all duration-300
                ${successId === node.id
                  ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/30 scale-[0.98] opacity-60'
                  : 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-600'
                }
              `}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">
                    {node.question}
                  </p>
                  {node.deferred_reason && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 flex items-center gap-1">
                      <ExclamationTriangleIcon className="w-3 h-3 flex-shrink-0" />
                      {node.deferred_reason}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 capitalize">
                      {node.type}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleReactivate(node.id)}
                  disabled={reactivating === node.id}
                  className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md
                             bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Reactivate this requirement"
                >
                  <ArrowPathIcon className={`w-3.5 h-3.5 ${reactivating === node.id ? 'animate-spin' : ''}`} />
                  Reactivate
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filtered empty */}
      {filtered.length === 0 && nodes.length > 0 && (
        <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center py-4">No items match &quot;{search}&quot;</p>
      )}
    </div>
  );
}
