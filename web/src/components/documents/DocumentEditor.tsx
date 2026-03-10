'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeftIcon,
  CodeBracketSquareIcon,
  CurrencyDollarIcon,
  ShareIcon,
  ArrowDownTrayIcon,
  ClockIcon,
  XMarkIcon,
  SparklesIcon,
  EyeIcon,
  PencilIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import '@blocknote/mantine/style.css';
import { useTheme } from '@/contexts/ThemeContext';
import type { ScopeDocument, DocumentVersionInfo } from '@/lib/api';
import { getDocumentPDF, getDocumentDOCX, getDocumentVersions, createDocumentVersion, restoreDocumentVersion, renameDocumentVersion } from '@/lib/api';
import { useDocumentAutoSave } from '@/hooks/useDocumentAutoSave';
import VariableInserter from './VariableInserter';
import PricingTableBlock from './PricingTableBlock';
import DocumentShareModal from './DocumentShareModal';
import DocumentAIChat from './DocumentAIChat';
import DocumentPreview from './DocumentPreview';
import { MermaidBlockSpec } from './MermaidBlock';

interface DocumentEditorProps {
  document: ScopeDocument;
  onBack: () => void;
  onTitleChange: (title: string) => void;
  onStatusChange: (status: string) => void;
}

type PanelTab = 'variables' | 'pricing' | 'share' | 'versions' | 'ai' | 'preview' | null;

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
  const { theme } = useTheme();
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState<unknown[] | null>(
    doc.content?.length ? (doc.content as unknown[]) : null,
  );
  const [activePanel, setActivePanel] = useState<PanelTab>(null);
  const [versions, setVersions] = useState<DocumentVersionInfo[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [editingVersionName, setEditingVersionName] = useState('');
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const skipNextAutoSaveRef = useRef(false);

  // Extend BlockNote schema with custom mermaid block
  const schema = BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      mermaid: MermaidBlockSpec,
    },
  });

  const editor = useCreateBlockNote({
    schema,
    initialContent: doc.content?.length ? (doc.content as any) : undefined,
  });

  const { isSaving, lastSaved, error: saveError, saveNow } = useDocumentAutoSave({
    documentId: doc.id,
    content,
    enabled: true,
    debounceMs: 2000,
    skipRef: skipNextAutoSaveRef,
  });

  // Listen for editor changes
  useEffect(() => {
    const handleChange = () => {
      setContent(editor.document as unknown[]);
    };

    // BlockNote 0.47+ uses editor.onChange
    editor.onChange(handleChange);
  }, [editor]);

  // Close export menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportMenu]);

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

  const handleInsertAIBlocks = useCallback(
    (blocks: any[]) => {
      if (!blocks || blocks.length === 0) return;
      // Assign unique IDs to every block to avoid conflicts on repeated inserts
      const stampIds = (blks: any[]): any[] =>
        blks.map((b: any) => ({
          ...b,
          id: crypto.randomUUID(),
          children: b.children?.length ? stampIds(b.children) : [],
        }));
      const freshBlocks = stampIds(blocks);
      try {
        // Always insert at end of document for reliability
        const lastBlock = editor.document[editor.document.length - 1];
        if (lastBlock) {
          editor.insertBlocks(freshBlocks, lastBlock, 'after');
        }
      } catch {
        // Fallback: try cursor position
        try {
          const currentBlock = editor.getTextCursorPosition().block;
          editor.insertBlocks(freshBlocks, currentBlock, 'after');
        } catch {
          console.error('Failed to insert AI blocks');
        }
      }
    },
    [editor],
  );

  const handleDocumentUpdatedByAI = useCallback(
    (newContent: any[]) => {
      if (!newContent || !Array.isArray(newContent) || newContent.length === 0) return;

      // Strip IDs from backend content so BlockNote auto-generates fresh ones
      const stripIds = (blks: any[]): any[] =>
        blks.map(({ id, ...rest }: any) => ({
          ...rest,
          children: rest.children?.length ? stripIds(rest.children) : [],
        }));
      const cleanBlocks = stripIds(newContent);

      try {
        // Atomic replace — single operation, no empty-document intermediate state
        editor.replaceBlocks(editor.document, cleanBlocks);
      } catch {
        try {
          // Fallback: insert new blocks BEFORE the first block, then remove old ones
          const oldIds = editor.document.map((b: any) => b.id);
          if (editor.document[0]) {
            editor.insertBlocks(cleanBlocks, editor.document[0], 'before');
            editor.removeBlocks(oldIds);
          }
        } catch (err2) {
          console.error('Failed to apply AI updates to editor:', err2);
          return;
        }
      }

      // Skip the next auto-save — the backend already has the correct content.
      // editor.onChange will fire and update the content state naturally.
      skipNextAutoSaveRef.current = true;
    },
    [editor],
  );

  const handleDownloadPDF = async () => {
    setDownloadingPDF(true);
    setShowExportMenu(false);
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

  const handleDownloadDOCX = async () => {
    setDownloadingPDF(true);
    setShowExportMenu(false);
    try {
      const blob = await getDocumentDOCX(doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'document'}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('DOCX download failed:', err);
    } finally {
      setDownloadingPDF(false);
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    setRestoringVersionId(versionId);
    try {
      const result = await restoreDocumentVersion(doc.id, versionId);
      // Replace editor content with restored blocks
      if (result.content && Array.isArray(result.content) && result.content.length > 0) {
        const stripIds = (blks: any[]): any[] =>
          blks.map(({ id, ...rest }: any) => ({
            ...rest,
            children: rest.children?.length ? stripIds(rest.children) : [],
          }));
        const cleanBlocks = stripIds(result.content as any[]);
        try {
          editor.replaceBlocks(editor.document, cleanBlocks);
        } catch {
          const oldIds = editor.document.map((b: any) => b.id);
          if (editor.document[0]) {
            editor.insertBlocks(cleanBlocks, editor.document[0], 'before');
            editor.removeBlocks(oldIds);
          }
        }
        skipNextAutoSaveRef.current = true;
      }
      // Refresh version list
      const updatedVersions = await getDocumentVersions(doc.id);
      setVersions(updatedVersions);
    } catch (err) {
      console.error('Failed to restore version:', err);
    } finally {
      setRestoringVersionId(null);
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

  const handleRenameVersion = async (versionId: string) => {
    const newName = editingVersionName.trim();
    if (!newName) {
      setEditingVersionId(null);
      return;
    }
    try {
      const updated = await renameDocumentVersion(doc.id, versionId, newName);
      setVersions((prev) =>
        prev.map((v) => (v.id === versionId ? { ...v, change_summary: updated.change_summary } : v)),
      );
    } catch (err) {
      console.error('Failed to rename version:', err);
    } finally {
      setEditingVersionId(null);
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
    <div className="flex h-full flex-col bg-white dark:bg-[#060606]">
      {/* Top Bar */}
      <div className="flex items-center gap-3 border-b border-neutral-200 dark:border-neutral-700 px-4 py-3">
        <button
          onClick={onBack}
          className="rounded-md p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeftIcon className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
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
          className="flex-1 min-w-0 text-lg font-semibold text-neutral-900 dark:text-neutral-100 bg-transparent border-none outline-none focus:ring-0 placeholder:text-neutral-400"
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
            onClick={() => togglePanel('ai')}
            className={`rounded-md p-2 transition-colors ${
              activePanel === 'ai'
                ? 'bg-brand-lime text-brand-dark'
                : 'text-brand-dark dark:text-[#E4FF1A] hover:bg-brand-lime/20'
            }`}
            title="AI Assistant"
          >
            <SparklesIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => togglePanel('preview')}
            className={`rounded-md p-2 transition-colors ${
              activePanel === 'preview'
                ? 'bg-indigo-600 text-white'
                : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30'
            }`}
            title="Live Preview"
          >
            <EyeIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => togglePanel('variables')}
            className={`rounded-md p-2 transition-colors ${
              activePanel === 'variables'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
            title="Variables"
          >
            <CodeBracketSquareIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => togglePanel('pricing')}
            className={`rounded-md p-2 transition-colors ${
              activePanel === 'pricing'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
            title="Pricing"
          >
            <CurrencyDollarIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => togglePanel('versions')}
            className={`rounded-md p-2 transition-colors ${
              activePanel === 'versions'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
            title="Version History"
          >
            <ClockIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => togglePanel('share')}
            className={`rounded-md p-2 transition-colors ${
              activePanel === 'share'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
            title="Share"
          >
            <ShareIcon className="h-5 w-5" />
          </button>
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu((prev) => !prev)}
              disabled={downloadingPDF}
              className="rounded-md p-2 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
              title="Download"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg z-50">
                <button
                  onClick={handleDownloadPDF}
                  className="w-full text-left px-4 py-2.5 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-t-lg"
                >
                  Download as PDF
                </button>
                <button
                  onClick={handleDownloadDOCX}
                  className="w-full text-left px-4 py-2.5 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-b-lg"
                >
                  Download as Word
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Editor */}
        <div className="flex-1 overflow-auto dark:bg-neutral-900 dark:text-neutral-100">
          <div className="max-w-4xl mx-auto py-8 px-6">
            <BlockNoteView editor={editor} theme={theme === 'dark' ? 'dark' : 'light'} />
          </div>
        </div>

        {/* Side Panel */}
        {activePanel && (
          <div className={`${
            activePanel === 'preview' ? 'w-[50%]' : 'w-80'
          } border-l border-neutral-200 dark:border-neutral-700 bg-[#f8f8f8] dark:bg-[#0a0a0a] flex flex-col overflow-hidden animate-in slide-in-from-right duration-200`}>
            {/* Panel Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {activePanel === 'ai'
                  ? 'AI Assistant'
                  : activePanel === 'preview'
                  ? 'Live Preview'
                  : activePanel === 'versions'
                  ? 'Version History'
                  : activePanel?.charAt(0).toUpperCase() + activePanel?.slice(1)}
              </h3>
              <button
                onClick={() => setActivePanel(null)}
                className="rounded-md p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
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
                <PricingTableBlock
                  documentId={doc.id}
                  sessionId={doc.session_id}
                  onInsertBlock={() => {
                    // Insert a pricingTable block at the current cursor position
                    try {
                      const currentBlock = editor.getTextCursorPosition().block;
                      editor.insertBlocks(
                        [{ type: 'pricingTable' as any, props: {}, content: [] }],
                        currentBlock,
                        'after',
                      );
                    } catch {
                      // Fallback: append at end
                      const lastBlock = editor.document[editor.document.length - 1];
                      if (lastBlock) {
                        editor.insertBlocks(
                          [{ type: 'pricingTable' as any, props: {}, content: [] }],
                          lastBlock,
                          'after',
                        );
                      }
                    }
                  }}
                />
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

              {activePanel === 'ai' && (
                <DocumentAIChat
                  documentId={doc.id}
                  sessionId={doc.session_id}
                  onInsertBlocks={handleInsertAIBlocks}
                  onDocumentUpdated={handleDocumentUpdatedByAI}
                />
              )}

              {activePanel === 'preview' && (
                <DocumentPreview
                  title={title}
                  content={content || []}
                  className="h-full"
                />
              )}

              {activePanel === 'versions' && (
                <div className="p-4">
                  <button
                    onClick={handleCreateVersion}
                    className="w-full mb-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    Create Snapshot
                  </button>

                  {loadingVersions && (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="h-4 w-2/3 bg-neutral-200 dark:bg-neutral-700 rounded mb-1" />
                          <div className="h-3 w-1/2 bg-neutral-100 dark:bg-neutral-800 rounded" />
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
                          className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              {editingVersionId === v.id ? (
                                <div className="flex items-center gap-1 flex-1">
                                  <input
                                    type="text"
                                    value={editingVersionName}
                                    onChange={(e) => setEditingVersionName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleRenameVersion(v.id);
                                      if (e.key === 'Escape') setEditingVersionId(null);
                                    }}
                                    autoFocus
                                    className="flex-1 text-xs rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-1.5 py-1 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                                  />
                                  <button
                                    onClick={() => handleRenameVersion(v.id)}
                                    className="p-0.5 rounded hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600"
                                    title="Save"
                                  >
                                    <CheckIcon className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingVersionId(null)}
                                    className="p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                                    title="Cancel"
                                  >
                                    <XMarkIcon className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                                    Version {v.version_number}
                                  </span>
                                  <button
                                    onClick={() => {
                                      setEditingVersionId(v.id);
                                      setEditingVersionName(v.change_summary || `Version ${v.version_number}`);
                                    }}
                                    className="p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 flex-shrink-0"
                                    title="Rename version"
                                  >
                                    <PencilIcon className="h-3 w-3" />
                                  </button>
                                </>
                              )}
                            </div>
                            <span className="text-xs text-neutral-500 flex-shrink-0 ml-2">
                              {formatVersionDate(v.created_at)}
                            </span>
                          </div>

                          {editingVersionId !== v.id && v.change_summary && (
                            <p className="text-xs text-neutral-500 mb-1">{v.change_summary}</p>
                          )}

                          {v.author_name && (
                            <p className="text-xs text-neutral-400">
                              by {v.author_name}
                            </p>
                          )}

                          {/* Expand/collapse details */}
                          <button
                            onClick={() =>
                              setExpandedVersionId(expandedVersionId === v.id ? null : v.id)
                            }
                            className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                          >
                            {expandedVersionId === v.id ? (
                              <>
                                <ChevronUpIcon className="h-3 w-3" /> Hide details
                              </>
                            ) : (
                              <>
                                <ChevronDownIcon className="h-3 w-3" /> Show details
                              </>
                            )}
                          </button>

                          {/* Expanded version details */}
                          {expandedVersionId === v.id && v.content_preview && (
                            <div className="mt-2 rounded-md bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700 p-2.5 text-[11px] text-neutral-600 dark:text-neutral-400 max-h-40 overflow-y-auto">
                              <p className="font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                                Sections in this version:
                              </p>
                              {v.content_preview.map((section: string, i: number) => (
                                <div key={i} className="flex items-start gap-1.5 py-0.5">
                                  <span className="text-neutral-400">•</span>
                                  <span>{section}</span>
                                </div>
                              ))}
                              {v.content_preview.length === 0 && (
                                <span className="text-neutral-400 italic">No sections</span>
                              )}
                            </div>
                          )}

                          <button
                            onClick={() => handleRestoreVersion(v.id)}
                            disabled={restoringVersionId === v.id}
                            className="mt-2 w-full rounded-md border border-neutral-200 dark:border-neutral-600 px-2 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                          >
                            {restoringVersionId === v.id ? 'Restoring...' : 'Restore this version'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
