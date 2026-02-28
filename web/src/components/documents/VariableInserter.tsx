'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  MagnifyingGlassIcon,
  ClipboardDocumentIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline';
import type { ResolvedVariables } from '@/lib/api';
import { resolveDocumentVariables } from '@/lib/api';

interface VariableInserterProps {
  documentId: string;
  onInsert: (variable: string) => void;
}

interface VariableGroup {
  category: string;
  label: string;
  items: { key: string; label: string; value: string }[];
}

const CATEGORY_LABELS: Record<string, string> = {
  project: 'Project',
  org: 'Organization',
  date: 'Dates',
  team: 'Team',
  client: 'Client',
  other: 'Other',
};

function categorizeKey(key: string): string {
  const prefix = key.split('.')[0]?.toLowerCase();
  if (prefix && CATEGORY_LABELS[prefix]) return prefix;
  return 'other';
}

function formatLabel(key: string): string {
  // Remove prefix and format: "project.name" -> "Name"
  const parts = key.split('.');
  const label = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
  return label
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function VariableInserter({ documentId, onInsert }: VariableInserterProps) {
  const [variables, setVariables] = useState<ResolvedVariables>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    resolveDocumentVariables(documentId)
      .then(setVariables)
      .catch((err) => {
        console.error('Failed to resolve variables:', err);
        setError('Failed to load variables.');
      })
      .finally(() => setLoading(false));
  }, [documentId]);

  const groups = useMemo((): VariableGroup[] => {
    const entries = Object.entries(variables);
    const q = search.toLowerCase();

    const filtered = q
      ? entries.filter(
          ([key, value]) =>
            key.toLowerCase().includes(q) ||
            formatLabel(key).toLowerCase().includes(q) ||
            String(value ?? '').toLowerCase().includes(q),
        )
      : entries;

    const groupMap: Record<string, { key: string; label: string; value: string }[]> = {};

    for (const [key, value] of filtered) {
      const cat = categorizeKey(key);
      if (!groupMap[cat]) groupMap[cat] = [];
      groupMap[cat].push({ key, label: formatLabel(key), value });
    }

    // Sort groups by category order
    const order = Object.keys(CATEGORY_LABELS);
    return Object.entries(groupMap)
      .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
      .map(([category, items]) => ({
        category,
        label: CATEGORY_LABELS[category] || 'Other',
        items: items.sort((a, b) => a.label.localeCompare(b.label)),
      }));
  }, [variables, search]);

  const handleCopy = (key: string) => {
    const text = `{{${key}}}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    });
  };

  const handleInsert = (key: string) => {
    onInsert(key);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-neutral-200 dark:border-neutral-700">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Filter variables..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 py-1.5 pl-8 pr-3 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Loading */}
        {loading && (
          <div className="p-3 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-3 w-20 bg-neutral-200 dark:bg-neutral-700 rounded mb-2" />
                <div className="h-8 w-full bg-neutral-100 dark:bg-neutral-800 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="p-3">
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-xs text-red-700">
              {error}
            </div>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && groups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center px-4">
            <p className="text-sm text-neutral-500">
              {search ? 'No matching variables found.' : 'No variables available.'}
            </p>
          </div>
        )}

        {/* Variable Groups */}
        {!loading && !error && groups.length > 0 && (
          <div className="p-3 space-y-4">
            {groups.map((group) => (
              <div key={group.category}>
                <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                  {group.label}
                </h4>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center gap-2 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 group hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                          {item.label}
                        </p>
                        <p className="text-xs text-neutral-500 truncate" title={item.value}>
                          {item.value || '(empty)'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleCopy(item.key)}
                          className="rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          title="Copy variable"
                        >
                          <ClipboardDocumentIcon className="h-3.5 w-3.5 text-neutral-500" />
                        </button>
                        <button
                          onClick={() => handleInsert(item.key)}
                          className="rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          title="Insert variable"
                        >
                          <PlusCircleIcon className="h-3.5 w-3.5 text-neutral-500" />
                        </button>
                      </div>
                      {copiedKey === item.key && (
                        <span className="text-xs text-green-600 flex-shrink-0">Copied</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
