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
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import '@blocknote/mantine/style.css';
import { useTheme } from '@/contexts/ThemeContext';
import type { ScopeDocument, DocumentVersionInfo, DocumentApprovalInfo } from '@/lib/api';
import { getDocumentPDF, getDocumentDOCX, getDocumentVersions, createDocumentVersion, restoreDocumentVersion, renameDocumentVersion, getDocumentApprovals } from '@/lib/api';
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

type PanelTab = 'variables' | 'pricing' | 'share' | 'versions' | 'ai' | 'preview' | 'approvals' | null;

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
  /** Version card that is pending restore — shows the save-first dialog. */
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null);
  /** True when a saved active draft is held in memory — drives the "Return" button display. */
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  /** In-memory copy of the active draft saved before a restore. */
  const activeDraftRef = useRef<unknown[] | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const skipNextAutoSaveRef = useRef(false);
  const [approvals, setApprovals] = useState<DocumentApprovalInfo[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState(false);

  // Keep editor title input in sync when parent replaces document (e.g. after save/refetch).
  useEffect(() => {
    setTitle(doc.title || 'Untitled Document');
  }, [doc.id, doc.title]);

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

  /**
   * Replace editor content with an arbitrary block array (strips stale BlockNote IDs).
   * @param skipAutoSave - true (default) when the backend already has this content (e.g. after
   *   restoring a snapshot via the API). Pass false when the backend does NOT yet have this
   *   content (e.g. returning to the active draft after a snapshot restore) so auto-save fires.
   */
  const applyBlocksToEditor = (blocks: unknown[], skipAutoSave = true) => {
    const stripIds = (blks: any[]): any[] =>
      blks.map(({ id, ...rest }: any) => ({
        ...rest,
        children: rest.children?.length ? stripIds(rest.children) : [],
      }));
    const clean = stripIds(blocks as any[]);
    try {
      editor.replaceBlocks(editor.document, clean);
    } catch {
      const oldIds = editor.document.map((b: any) => b.id);
      if (editor.document[0]) {
        editor.insertBlocks(clean, editor.document[0], 'before');
        editor.removeBlocks(oldIds);
      }
    }
    // Only skip the auto-save cycle when the server already has this content.
    // When returning to draft, we need auto-save to push the draft content back to the server.
    skipNextAutoSaveRef.current = skipAutoSave;
  };

  /** Step 1: user clicks "Restore this version" — show the save dialog. */
  const handleRestoreClick = (versionId: string) => {
    setPendingRestoreId(versionId);
  };

  /** Step 2a: user chose "Save & Restore" — keep current content in memory, then restore. */
  const handleSaveAndRestore = async () => {
    if (!pendingRestoreId) return;
    const versionId = pendingRestoreId;
    setPendingRestoreId(null);
    setRestoringVersionId(versionId);
    try {
      // Deep-copy and remember the current editor content as the active draft.
      activeDraftRef.current = JSON.parse(JSON.stringify(editor.document)) as unknown[];
      setHasSavedDraft(true);
      await saveNow(); // persist the latest content to the DB as well

      const result = await restoreDocumentVersion(doc.id, versionId);
      if (result.content && Array.isArray(result.content) && result.content.length > 0) {
        applyBlocksToEditor(result.content);
      }
    } catch (err) {
      console.error('Failed to restore version:', err);
    } finally {
      setRestoringVersionId(null);
    }
  };

  /** Step 2b: user chose "Restore without saving" — just restore, no draft remembered. */
  const handleRestoreWithoutSaving = async () => {
    if (!pendingRestoreId) return;
    const versionId = pendingRestoreId;
    setPendingRestoreId(null);
    setRestoringVersionId(versionId);
    try {
      activeDraftRef.current = null;
      setHasSavedDraft(false);
      const result = await restoreDocumentVersion(doc.id, versionId);
      if (result.content && Array.isArray(result.content) && result.content.length > 0) {
        applyBlocksToEditor(result.content);
      }
    } catch (err) {
      console.error('Failed to restore version:', err);
    } finally {
      setRestoringVersionId(null);
    }
  };

  /** Return to the active draft saved in memory and write it back to the DB. */
  const handleReturnToActiveDraft = async () => {
    const draft = activeDraftRef.current;
    if (!draft || draft.length === 0) return;
    // skipAutoSave=false so auto-save pushes the draft back to the server.
    applyBlocksToEditor(draft, false);
    activeDraftRef.current = null;
    setHasSavedDraft(false);
  };

  const handleCreateVersion = async () => {
    try {
      // Flush any pending auto-save first so the DB has the latest content
      // before the snapshot is created (auto-save debounces 2 s, snapshot reads from DB).
      await saveNow();
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

  // Fetch approvals when panel opens
  useEffect(() => {
    if (activePanel !== 'approvals') return;
    setLoadingApprovals(true);
    getDocumentApprovals(doc.id)
      .then(setApprovals)
      .catch(() => setApprovals([]))
      .finally(() => setLoadingApprovals(false));
  }, [activePanel, doc.id]);

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
          <button
            onClick={() => togglePanel('approvals')}
            className={`rounded-md p-2 transition-colors ${
              activePanel === 'approvals'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
            title="Approvals"
          >
            <ClipboardDocumentCheckIcon className="h-5 w-5" />
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

              {activePanel === 'approvals' && (
                <div className="p-4">
                  {loadingApprovals ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin h-6 w-6 border-2 border-neutral-300 border-t-neutral-700 rounded-full" />
                    </div>
                  ) : approvals.length === 0 ? (
                    <div className="text-center py-12">
                      <ClipboardDocumentCheckIcon className="h-10 w-10 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">No approvers added yet.</p>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                        Add recipients with the &quot;Approver&quot; role in the Share panel.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {approvals.map((a) => {
                        const isPending = a.decision === 'pending';
                        const isApproved = a.decision === 'approved';
                        const isRejected = a.decision === 'rejected';
                        return (
                          <div
                            key={a.recipient_id}
                            className={`rounded-lg border p-4 ${
                              isApproved
                                ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20'
                                : isRejected
                                ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20'
                                : 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                                  {a.recipient_name}
                                </p>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                                  {a.recipient_email}
                                </p>
                              </div>
                              <span
                                className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  isApproved
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                    : isRejected
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                    : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
                                }`}
                              >
                                {isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Pending'}
                              </span>
                            </div>
                            {a.reason && (
                              <div className={`mt-2 text-xs rounded-md px-3 py-2 ${
                                isRejected
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                  : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
                              }`}>
                                <span className="font-medium">Reason:</span> {a.reason}
                              </div>
                            )}
                            {!isPending && a.decided_at && (
                              <p className="mt-1.5 text-[11px] text-neutral-400">
                                {new Date(a.decided_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
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
                  {/* Return to active draft — shown only when a saved draft exists in memory */}
                  {hasSavedDraft && (
                    <button
                      onClick={handleReturnToActiveDraft}
                      className="w-full mb-3 flex items-center justify-center gap-1.5 rounded-lg border-2 border-brand-lime dark:border-[#E4FF1A] bg-brand-lime/10 dark:bg-[#E4FF1A]/10 px-3 py-2 text-sm font-semibold text-neutral-900 dark:text-[#E4FF1A] hover:bg-brand-lime/20 dark:hover:bg-[#E4FF1A]/20 transition-colors"
                    >
                      <ArrowLeftIcon className="h-4 w-4" />
                      Return to active draft
                    </button>
                  )}

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

                          {/* Save-first dialog — inline, only for this card */}
                          {pendingRestoreId === v.id ? (
                            <div className="mt-2 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800/60 p-3 space-y-2">
                              <p className="text-xs text-neutral-700 dark:text-neutral-300 font-medium">
                                Save your current changes before restoring?
                              </p>
                              <p className="text-[11px] text-neutral-500">
                                Your active document will be remembered so you can return to it with the button above.
                              </p>
                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={handleSaveAndRestore}
                                  className="flex-1 rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-2 py-1.5 text-xs font-semibold hover:bg-neutral-700 dark:hover:bg-neutral-300 transition-colors"
                                >
                                  Save &amp; Restore
                                </button>
                                <button
                                  onClick={handleRestoreWithoutSaving}
                                  className="flex-1 rounded-md border border-neutral-300 dark:border-neutral-600 px-2 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                                >
                                  Restore only
                                </button>
                                <button
                                  onClick={() => setPendingRestoreId(null)}
                                  className="rounded-md border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleRestoreClick(v.id)}
                              disabled={restoringVersionId === v.id}
                              className="mt-2 w-full rounded-md border border-neutral-200 dark:border-neutral-600 px-2 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                            >
                              {restoringVersionId === v.id ? 'Restoring...' : 'Restore this version'}
                            </button>
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

      </div>
    </div>
  );
}
