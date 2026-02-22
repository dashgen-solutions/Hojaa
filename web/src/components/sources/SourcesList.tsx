'use client';

import { useState, useEffect } from 'react';
import {
  TrashIcon, DocumentTextIcon, ChatBubbleLeftRightIcon,
  PencilSquareIcon, XMarkIcon, ArrowPathIcon,
  CheckCircleIcon, ClockIcon, XCircleIcon,
} from '@heroicons/react/24/outline';
import { useStore, Source } from '@/stores/useStore';

interface SourcesListProps {
  sessionId: string;
  onSelectSource?: (sourceId: string) => void;
}

const SOURCE_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  meeting: { label: 'Meeting', icon: ChatBubbleLeftRightIcon, color: 'bg-blue-100 text-blue-700' },
  document: { label: 'Document', icon: DocumentTextIcon, color: 'bg-purple-100 text-purple-700' },
  manual: { label: 'Manual', icon: PencilSquareIcon, color: 'bg-amber-100 text-amber-700' },
  discovery: { label: 'Discovery', icon: DocumentTextIcon, color: 'bg-green-100 text-green-700' },
};

export default function SourcesList({ sessionId, onSelectSource }: SourcesListProps) {
  const { sources, deleteSource, reanalyzeSource, fetchSourceDetail, fetchSources } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const [reanalyzingSourceId, setReanalyzingSourceId] = useState<string | null>(null);

  // Fetch sources on mount and whenever sessionId changes
  useEffect(() => {
    fetchSources(sessionId);
  }, [sessionId, fetchSources]);

  if (sources.length === 0) {
    return null;
  }

  const handleDeleteSource = async (event: React.MouseEvent, sourceId: string) => {
    // Stop propagation so it doesn't trigger the row click
    event.stopPropagation();
    if (!window.confirm('Delete this source? Pending suggestions will be removed.')) return;
    setDeletingSourceId(sourceId);
    try {
      await deleteSource(sourceId, sessionId);
    } finally {
      setDeletingSourceId(null);
    }
  };

  const handleSelectSource = async (sourceId: string) => {
    await fetchSourceDetail(sourceId);
    onSelectSource?.(sourceId);
    setIsOpen(false);
  };

  const handleReanalyze = async (event: React.MouseEvent, sourceId: string) => {
    event.stopPropagation();
    if (!window.confirm('Re-run AI analysis on this source? Pending suggestions will be replaced with fresh ones.')) return;
    setReanalyzingSourceId(sourceId);
    try {
      const result = await reanalyzeSource(sourceId, sessionId);
      // Open the refreshed detail so the user can review new suggestions
      onSelectSource?.(sourceId);
      setIsOpen(false);
    } catch {
      // Error handled by store
    } finally {
      setReanalyzingSourceId(null);
    }
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-900 
                   transition-colors px-2 py-1 rounded-md hover:bg-neutral-100"
      >
        <DocumentTextIcon className="w-3.5 h-3.5" />
        {sources.length} source{sources.length !== 1 ? 's' : ''}
      </button>

      {/* Full-screen overlay modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-md shadow w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">Ingested Sources</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {sources.length} source{sources.length !== 1 ? 's' : ''} for this session
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-md hover:bg-neutral-100 transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            {/* Source list */}
            <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100">
              {sources.map((source: Source) => {
                const typeConfig = SOURCE_TYPE_CONFIG[source.source_type] || SOURCE_TYPE_CONFIG.document;
                const TypeIcon = typeConfig.icon;
                const isDeleting = deletingSourceId === source.id;

                return (
                  <div
                    key={source.id}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-neutral-50 transition-colors"
                  >
                    {/* Source info — click to review suggestions */}
                    <button
                      onClick={() => handleSelectSource(source.id)}
                      className="flex-1 flex items-start gap-3 text-left min-w-0"
                    >
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium shrink-0 mt-0.5 ${typeConfig.color}`}>
                        <TypeIcon className="w-3 h-3" />
                        {typeConfig.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-800 truncate">
                          {source.source_name}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          {source.approved_count > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-green-600">
                              <CheckCircleIcon className="w-3 h-3" />
                              {source.approved_count} approved
                            </span>
                          )}
                          {source.pending_count > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600">
                              <ClockIcon className="w-3 h-3" />
                              {source.pending_count} pending
                            </span>
                          )}
                          {source.rejected_count > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-red-500">
                              <XCircleIcon className="w-3 h-3" />
                              {source.rejected_count} rejected
                            </span>
                          )}
                          {source.suggestions_count === 0 && (
                            <span className="text-[10px] text-neutral-400">No suggestions</span>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Re-analyze button */}
                    <button
                      onClick={(event) => handleReanalyze(event, source.id)}
                      disabled={reanalyzingSourceId === source.id}
                      className="p-2 rounded-md text-neutral-400 hover:text-blue-600 hover:bg-blue-50
                                 transition-colors disabled:opacity-50 shrink-0"
                      title="Re-analyze source"
                    >
                      {reanalyzingSourceId === source.id ? (
                        <div className="w-4 h-4 border-2 border-neutral-300 border-t-blue-500 rounded-full animate-spin" />
                      ) : (
                        <ArrowPathIcon className="w-4 h-4" />
                      )}
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={(event) => handleDeleteSource(event, source.id)}
                      disabled={isDeleting}
                      className="p-2 rounded-md text-neutral-400 hover:text-red-600 hover:bg-red-50
                                 transition-colors disabled:opacity-50 shrink-0"
                      title="Delete source"
                    >
                      {isDeleting ? (
                        <div className="w-4 h-4 border-2 border-neutral-300 border-t-red-500 rounded-full animate-spin" />
                      ) : (
                        <TrashIcon className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-neutral-200 bg-neutral-50">
              <p className="text-[10px] text-neutral-400">
                Click a source to review its suggestions. Delete removes pending suggestions only.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
