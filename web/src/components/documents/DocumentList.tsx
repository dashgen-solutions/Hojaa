'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  EllipsisVerticalIcon,
  DocumentDuplicateIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  FolderOpenIcon,
  DocumentTextIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  ClipboardDocumentListIcon,
  DocumentCheckIcon,
  PaperAirplaneIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import type { ScopeDocument } from '@/lib/api';
import { getDocumentPDF } from '@/lib/api';

interface DocumentListProps {
  documents: ScopeDocument[];
  onSelect: (id: string) => void;
  onNew: () => void;
  onNewFromTemplate: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  loading: boolean;
}

const STATUS_TABS = ['all', 'draft', 'sent', 'viewed', 'completed'] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string; icon: typeof DocumentTextIcon; accent: string }> = {
  draft: { bg: 'bg-neutral-100', text: 'text-neutral-600', label: 'Draft', icon: DocumentTextIcon, accent: 'border-l-neutral-400' },
  sent: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Sent', icon: PaperAirplaneIcon, accent: 'border-l-blue-400' },
  viewed: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Viewed', icon: EyeIcon, accent: 'border-l-amber-400' },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Completed', icon: DocumentCheckIcon, accent: 'border-l-emerald-400' },
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-5 animate-pulse">
      <div className="flex items-start gap-3.5">
        <div className="w-9 h-9 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
        <div className="flex-1 min-w-0">
          <div className="h-4 w-3/4 bg-neutral-200 dark:bg-neutral-700 rounded mb-2.5" />
          <div className="h-3 w-1/3 bg-neutral-100 dark:bg-neutral-800 rounded mb-3" />
          <div className="flex items-center gap-3">
            <div className="h-3 w-16 bg-neutral-100 dark:bg-neutral-800 rounded" />
            <div className="h-3 w-16 bg-neutral-100 dark:bg-neutral-800 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DocumentList({
  documents,
  onSelect,
  onNew,
  onNewFromTemplate,
  onDuplicate,
  onDelete,
  loading,
}: DocumentListProps) {
  const [statusFilter, setStatusFilter] = useState<StatusTab>('all');
  const [search, setSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const cardMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (cardMenuRef.current && !cardMenuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    let result = documents;
    if (statusFilter !== 'all') {
      result = result.filter((d) => d.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((d) => d.title.toLowerCase().includes(q));
    }
    return result;
  }, [documents, statusFilter, search]);

  // Count by status for tab badges
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: documents.length };
    for (const doc of documents) {
      counts[doc.status] = (counts[doc.status] || 0) + 1;
    }
    return counts;
  }, [documents]);

  const handleDownloadPDF = async (docId: string) => {
    setDownloadingId(docId);
    setOpenMenuId(null);
    try {
      const blob = await getDocumentPDF(docId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `document-${docId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download failed:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filter Tabs + Search */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 text-xs font-medium capitalize rounded-md transition-all ${
                statusFilter === tab
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              {tab === 'all' ? 'All' : tab}
              {(statusCounts[tab] || 0) > 0 && (
                <span className={`ml-1.5 ${statusFilter === tab ? 'text-neutral-400' : 'text-neutral-400'}`}>
                  {statusCounts[tab]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="relative w-64">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 py-2 pl-9 pr-3 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
          />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
            <ClipboardDocumentListIcon className="h-8 w-8 text-neutral-400" />
          </div>
          <p className="text-base font-medium text-neutral-900 dark:text-neutral-100 mb-1">No documents yet</p>
          <p className="text-sm text-neutral-500 mb-5 max-w-xs">
            {search || statusFilter !== 'all'
              ? 'Try adjusting your filters or search query.'
              : 'Create proposals, contracts, and SOWs \u2014 all linked to your project scope.'}
          </p>
          {!search && statusFilter === 'all' && (
            <button
              onClick={onNew}
              className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              Create Document
            </button>
          )}
        </div>
      )}

      {/* Document Grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((doc) => {
            const config = STATUS_CONFIG[doc.status] || STATUS_CONFIG.draft;
            const StatusIcon = config.icon;
            return (
              <div
                key={doc.id}
                className={`group relative rounded-lg border border-neutral-200 dark:border-neutral-700 border-l-[3px] ${config.accent} bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-md transition-all cursor-pointer`}
                onClick={() => onSelect(doc.id)}
              >
                {/* Card Menu */}
                <div
                  ref={openMenuId === doc.id ? cardMenuRef : undefined}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === doc.id ? null : doc.id);
                    }}
                    className="rounded-md p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm"
                  >
                    <EllipsisVerticalIcon className="h-5 w-5 text-neutral-500" />
                  </button>
                  {openMenuId === doc.id && (
                    <div className="absolute right-0 mt-1 w-44 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg z-30">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(null);
                          onSelect(doc.id);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-t-lg"
                      >
                        <FolderOpenIcon className="h-4 w-4 text-neutral-400" />
                        Open
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(null);
                          onDuplicate(doc.id);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                      >
                        <DocumentDuplicateIcon className="h-4 w-4 text-neutral-400" />
                        Duplicate
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadPDF(doc.id);
                        }}
                        disabled={downloadingId === doc.id}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
                      >
                        <ArrowDownTrayIcon className="h-4 w-4 text-neutral-400" />
                        {downloadingId === doc.id ? 'Downloading...' : 'Download PDF'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(null);
                          onDelete(doc.id);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-b-lg"
                      >
                        <TrashIcon className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  {/* Icon + Title Row */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${config.bg} flex items-center justify-center`}>
                      <StatusIcon className={`h-4.5 w-4.5 ${config.text}`} />
                    </div>
                    <div className="flex-1 min-w-0 pr-6">
                      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate leading-tight">
                        {doc.title || 'Untitled Document'}
                      </h3>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {formatRelativeTime(doc.updated_at)}
                        {doc.creator_name && <span className="mx-1.5">&middot;</span>}
                        {doc.creator_name}
                      </p>
                    </div>
                  </div>

                  {/* Status + Meta Row */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {config.label}
                    </span>
                    <div className="flex items-center gap-3">
                      {(doc.recipients_count ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-neutral-400" title="Recipients">
                          <UserGroupIcon className="h-3.5 w-3.5" />
                          {doc.recipients_count}
                        </span>
                      )}
                      {(doc.pricing_items_count ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-neutral-400" title="Pricing items">
                          <CurrencyDollarIcon className="h-3.5 w-3.5" />
                          {doc.pricing_items_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
