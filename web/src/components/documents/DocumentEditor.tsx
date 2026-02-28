'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeftIcon,
  ChevronDoubleRightIcon,
  ChevronDoubleLeftIcon,
  CodeBracketSquareIcon,
  CurrencyDollarIcon,
  ShareIcon,
  ArrowDownTrayIcon,
  ClockIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import type { ScopeDocument, DocumentVersionInfo } from '@/lib/api';
import { getDocumentPDF, getDocumentVersions, createDocumentVersion } from '@/lib/api';
import { useDocumentAutoSave } from '@/hooks/useDocumentAutoSave';
import VariableInserter from './VariableInserter';
import PricingTableBlock from './PricingTableBlock';
import DocumentShareModal from './DocumentShareModal';

interface DocumentEditorProps {
  document: ScopeDocument;
  onBack: () => void;
  onTitleChange: (title: string) => void;
  onStatusChange: (status: string) => void;
}

type PanelTab = 'variables' | 'pricing' | 'share' | 'versions' | null;

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-neutral-100', text: 'text-neutral-600', label: 'Draft' },
  sent: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Sent' },
  viewed: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Viewed' },
  completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' },
};

function formatVersionDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DocumentEditor({
  document: doc,
  onBack,
  onTitleChange,
  onStatusChange,
}: DocumentEditorProps) {
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState<unknown[] | null>(
    doc.content?.length ? (doc.content as unknown[]) : null,
  );
  const [activePanel, setActivePanel] = useState<PanelTab>(null);
  const [versions, setVersions] = useState<DocumentVersionInfo[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const editor = useCreateBlockNote({
    initialContent: doc.content?.length ? (doc.content as any) : undefined,
  });

  const { isSaving, lastSaved, error: saveError } = useDocumentAutoSave({
    documentId: doc.id,
    content,
    enabled: true,
    debounceMs: 2000,
  });

  // Listen for editor changes
  useEffect(() => {
    const handleChange = () => {
      setContent(editor.document as unknown[]);
    };

    // BlockNote 0.47+ uses editor.onChange
    editor.onChange(handleChange);
  }, [editor]);

  // Fetch versions when panel opens
  useEffect(() => {
    if (activePanel === 'versions') {
      setLoadingVersions(true);
      getDocumentVersions(doc.id)
        .then(setVersions)
        .catch((err) => console.error('Failed to load versions:', err))
        .finally(() => setLoadingVersions(false));
    }
  }, [activePanel, doc.id]);

  const handleTitleBlur = useCallback(() => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== doc.title) {
      onTitleChange(trimmed);
    }
  }, [title, doc.title, onTitleChange]);

  const handleVariableInsert = useCallback(
    (variable: string) => {
      const currentBlock = editor.getTextCursorPosition().block;
      editor.updateBlock(currentBlock, {
        content: [
          ...((currentBlock.content as any[]) || []),
          { type: 'text', text: `{{${variable}}}`, styles: {} },
        ],
      });
    },
    [editor],
  );

  const handleDownloadPDF = async () => {
    setDownloadingPDF(true);
    try {
      const blob = await getDocumentPDF(doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'document'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download failed:', err);
    } finally {
      setDownloadingPDF(false);
    }
  };

  const handleCreateVersion = async () => {
    try {
      const version = await createDocumentVersion(doc.id, 'Manual snapshot');
      setVersions((prev) => [version, ...prev]);
    } catch (err) {
      console.error('Failed to create version:', err);
    }
  };

  const togglePanel = (tab: PanelTab) => {
    setActivePanel((prev) => (prev === tab ? null : tab));
  };

  const badge = STATUS_BADGE[doc.status] || STATUS_BADGE.draft;

  // Save indicator text
  let saveIndicator = '';
  if (isSaving) {
    saveIndicator = 'Saving...';
  } else if (saveError) {
    saveIndicator = 'Save failed';
  } else if (lastSaved) {
    saveIndicator = 'Saved';
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Top Bar */}
      <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3">
        <button
          onClick={onBack}
          className="rounded-md p-1.5 hover:bg-neutral-100 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeftIcon className="h-5 w-5 text-neutral-600" />
        </button>

        {/* Editable Title */}
        <input
          ref={titleInputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') titleInputRef.current?.blur();
          }}
          className="flex-1 min-w-0 text-lg font-semibold text-neutral-900 bg-transparent border-none outline-none focus:ring-0 placeholder:text-neutral-400"
          placeholder="Untitled Document"
        />

        {/* Status Badge */}
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}
        >
          {badge.label}
        </span>

        {/* Save Indicator */}
        {saveIndicator && (
          <span
            className={`text-xs ${
              saveError ? 'text-red-500' : isSaving ? 'text-neutral-400' : 'text-green-600'
            }`}
          >
            {saveIndicator}
          </span>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={() => togglePanel('variables')}
            className={`rounded-md p-2 text-sm transition-colors ${
              activePanel === 'variables'
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
            title="Variables"
          >
            <CodeBracketSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => togglePanel('pricing')}
            className={`rounded-md p-2 text-sm transition-colors ${
              activePanel === 'pricing'
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
            title="Pricing"
          >
            <CurrencyDollarIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => togglePanel('share')}
            className={`rounded-md p-2 text-sm transition-colors ${
              activePanel === 'share'
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
            title="Share"
          >
            <ShareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={downloadingPDF}
            className="rounded-md p-2 text-neutral-600 hover:bg-neutral-100 transition-colors disabled:opacity-50"
            title="Download PDF"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Editor */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-4xl mx-auto py-8 px-6">
            <BlockNoteView editor={editor} theme="light" />
          </div>
        </div>

        {/* Side Panel */}
        {activePanel && (
          <div className="w-80 border-l border-neutral-200 bg-[#f8f8f8] flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-white">
              <h3 className="text-sm font-semibold text-neutral-900 capitalize">
                {activePanel}
              </h3>
              <button
                onClick={() => setActivePanel(null)}
                className="rounded-md p-1 hover:bg-neutral-100"
              >
                <XMarkIcon className="h-4 w-4 text-neutral-500" />
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-auto">
              {activePanel === 'variables' && (
                <VariableInserter documentId={doc.id} onInsert={handleVariableInsert} />
              )}

              {activePanel === 'pricing' && (
                <PricingTableBlock documentId={doc.id} sessionId={doc.session_id} />
              )}

              {activePanel === 'share' && (
                <div className="p-4">
                  <DocumentShareModal
                    documentId={doc.id}
                    shareToken={doc.share_token}
                    isOpen={true}
                    onClose={() => setActivePanel(null)}
                  />
                </div>
              )}

              {activePanel === 'versions' && (
                <div className="p-4">
                  <button
                    onClick={handleCreateVersion}
                    className="w-full mb-4 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                  >
                    Create Snapshot
                  </button>

                  {loadingVersions && (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="h-4 w-2/3 bg-neutral-200 rounded mb-1" />
                          <div className="h-3 w-1/2 bg-neutral-100 rounded" />
                        </div>
                      ))}
                    </div>
                  )}

                  {!loadingVersions && versions.length === 0 && (
                    <p className="text-sm text-neutral-500 text-center py-6">
                      No versions yet.
                    </p>
                  )}

                  {!loadingVersions && versions.length > 0 && (
                    <div className="space-y-3">
                      {versions.map((v) => (
                        <div
                          key={v.id}
                          className="rounded-lg border border-neutral-200 bg-white p-3"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-neutral-900">
                              Version {v.version_number}
                            </span>
                            <span className="text-xs text-neutral-500">
                              {formatVersionDate(v.created_at)}
                            </span>
                          </div>
                          {v.change_summary && (
                            <p className="text-xs text-neutral-500">{v.change_summary}</p>
                          )}
                          {v.author_name && (
                            <p className="text-xs text-neutral-400 mt-1">
                              by {v.author_name}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Panel Toggle Tabs (right edge) */}
        <div className="flex flex-col gap-1 py-2 px-1 bg-[#f8f8f8] border-l border-neutral-200">
          <button
            onClick={() => togglePanel('variables')}
            className={`rounded-md p-2 transition-colors ${
              activePanel === 'variables'
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-500 hover:bg-neutral-200'
            }`}
            title="Variables"
          >
            <CodeBracketSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => togglePanel('pricing')}
            className={`rounded-md p-2 transition-colors ${
              activePanel === 'pricing'
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-500 hover:bg-neutral-200'
            }`}
            title="Pricing"
          >
            <CurrencyDollarIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => togglePanel('versions')}
            className={`rounded-md p-2 transition-colors ${
              activePanel === 'versions'
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-500 hover:bg-neutral-200'
            }`}
            title="Version History"
          >
            <ClockIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => togglePanel('share')}
            className={`rounded-md p-2 transition-colors ${
              activePanel === 'share'
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-500 hover:bg-neutral-200'
            }`}
            title="Share"
          >
            <ShareIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
