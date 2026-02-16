'use client';

import { useState } from 'react';
import {
  XMarkIcon, DocumentTextIcon, CodeBracketIcon,
  DocumentArrowDownIcon, CheckIcon,
} from '@heroicons/react/24/outline';
import { useStore } from '@/stores/useStore';
import ExportHistory, { recordExport } from './ExportHistory';

interface ExportModalProps {
  sessionId: string;
  onClose: () => void;
}

const EXPORT_FORMATS = [
  {
    key: 'markdown',
    label: 'Markdown',
    description: 'Clean formatted text document',
    icon: DocumentTextIcon,
  },
  {
    key: 'json',
    label: 'JSON',
    description: 'Structured data for integrations',
    icon: CodeBracketIcon,
  },
  {
    key: 'pdf',
    label: 'PDF / HTML',
    description: 'Formatted scope document',
    icon: DocumentArrowDownIcon,
  },
];

export default function ExportModal({ sessionId, onClose }: ExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState('markdown');
  const [includeDeferred, setIncludeDeferred] = useState(false);
  const [includeChangeLog, setIncludeChangeLog] = useState(false);
  const [includeAssignments, setIncludeAssignments] = useState(false);
  const [includeSources, setIncludeSources] = useState(false);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [includeConversations, setIncludeConversations] = useState(false);
  const [detailLevel, setDetailLevel] = useState<'summary' | 'detailed' | 'full'>('detailed');
  const [pdfTemplate, setPdfTemplate] = useState<'standard' | 'executive' | 'technical'>('standard');
  const [isExporting, setIsExporting] = useState(false);
  const [exportedContent, setExportedContent] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  const { downloadMarkdown, downloadJson, downloadPdf } = useStore();

  // Clear old preview & success state whenever the user changes any option
  const clearPreviousExport = () => {
    if (exportedContent || exportSuccess) {
      setExportedContent(null);
      setExportSuccess(false);
    }
  };

  const changeFormat = (fmt: string) => { setSelectedFormat(fmt); clearPreviousExport(); };
  const toggleDeferred = () => { setIncludeDeferred(v => !v); clearPreviousExport(); };
  const toggleChangeLog = () => { setIncludeChangeLog(v => !v); clearPreviousExport(); };
  const toggleAssignments = () => { setIncludeAssignments(v => !v); clearPreviousExport(); };
  const toggleSources = () => { setIncludeSources(v => !v); clearPreviousExport(); };
  const toggleCompleted = () => { setIncludeCompleted(v => !v); clearPreviousExport(); };
  const toggleConversations = () => { setIncludeConversations(v => !v); clearPreviousExport(); };
  const changeDetailLevel = (dl: 'summary' | 'detailed' | 'full') => { setDetailLevel(dl); clearPreviousExport(); };
  const changeTemplate = (tpl: 'standard' | 'executive' | 'technical') => { setPdfTemplate(tpl); clearPreviousExport(); };

  const triggerFileDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    // Clear previous export state FIRST so the user sees a fresh loading state
    setExportedContent(null);
    setExportSuccess(false);
    setIsExporting(true);
    try {
      const exportOptions = {
        session_id: sessionId,
        include_deferred: includeDeferred,
        include_change_log: includeChangeLog,
        include_assignments: includeAssignments,
        include_sources: includeSources,
        include_completed: includeCompleted,
        include_conversations: includeConversations,
        detail_level: detailLevel,
        template: pdfTemplate,
      };

      // Unique timestamp so each download has a distinct filename
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

      if (selectedFormat === 'pdf') {
        // First, get markdown for preview
        const previewContent = await downloadMarkdown(exportOptions);
        setExportedContent(previewContent);

        // Then download the real PDF from backend
        const pdfBlob = await downloadPdf(exportOptions);
        const filename = `scope_document_${ts}.pdf`;
        triggerFileDownload(pdfBlob, filename);
        recordExport(sessionId, 'pdf', exportOptions, filename);
      } else if (selectedFormat === 'json') {
        const content = await downloadJson(exportOptions);
        setExportedContent(content);
        const filename = `scope_document_${ts}.json`;
        const blob = new Blob([content], { type: 'application/json' });
        triggerFileDownload(blob, filename);
        recordExport(sessionId, 'json', exportOptions, filename);
      } else {
        // Markdown (default)
        const content = await downloadMarkdown(exportOptions);
        setExportedContent(content);
        const filename = `scope_document_${ts}.md`;
        const blob = new Blob([content], { type: 'text/markdown' });
        triggerFileDownload(blob, filename);
        recordExport(sessionId, 'markdown', exportOptions, filename);
      }
      setExportSuccess(true);
    } catch (exportError) {
      console.error('Export failed:', exportError);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">Export Scope Document</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-100">
            <XMarkIcon className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Format selection */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Format</label>
            <div className="grid grid-cols-3 gap-3">
              {EXPORT_FORMATS.map((format) => (
                <button
                  key={format.key}
                  onClick={() => changeFormat(format.key)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    selectedFormat === format.key
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <format.icon className={`w-5 h-5 mb-1 ${
                    selectedFormat === format.key ? 'text-primary-600' : 'text-neutral-400'
                  }`} />
                  <p className={`text-sm font-medium ${
                    selectedFormat === format.key ? 'text-primary-700' : 'text-neutral-700'
                  }`}>{format.label}</p>
                  <p className="text-[10px] text-neutral-500 mt-0.5">{format.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Include</label>
            <div className="space-y-2">
              {[
                { key: 'deferred', label: 'Deferred items', description: 'Items pushed to later phases', value: includeDeferred, toggle: toggleDeferred },
                { key: 'changelog', label: 'Change log', description: 'History of all scope changes', value: includeChangeLog, toggle: toggleChangeLog },
                { key: 'assignments', label: 'Team assignments', description: 'Who is working on what', value: includeAssignments, toggle: toggleAssignments },
                { key: 'sources', label: 'Sources', description: 'Meeting notes, documents & origins', value: includeSources, toggle: toggleSources },
                { key: 'completed', label: 'Completed items', description: 'Items marked as done', value: includeCompleted, toggle: toggleCompleted },
                { key: 'conversations', label: 'Conversations', description: 'Chat history for each node', value: includeConversations, toggle: toggleConversations },
              ].map((option) => (
                <label
                  key={option.key}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50 cursor-pointer"
                >
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={option.value}
                      onChange={option.toggle}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                      option.value
                        ? 'bg-primary-600 border-primary-600'
                        : 'border-neutral-300'
                    }`}>
                      {option.value && <CheckIcon className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-800">{option.label}</p>
                    <p className="text-xs text-neutral-500">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Detail Level */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Detail Level</label>
            <select
              value={detailLevel}
              onChange={(e) => changeDetailLevel(e.target.value as 'summary' | 'detailed' | 'full')}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm 
                         text-neutral-800 bg-white focus:outline-none focus:ring-2 
                         focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="summary">Summary — titles only</option>
              <option value="detailed">Detailed — titles & descriptions</option>
              <option value="full">Full — everything incl. acceptance criteria</option>
            </select>
          </div>

          {/* Document Template */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Document Template</label>
            <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'standard', label: 'Standard', desc: 'Full scope document' },
                  { key: 'executive', label: 'Executive', desc: 'High-level summary' },
                  { key: 'technical', label: 'Technical', desc: 'Detailed with AC & hours' },
                ].map((tpl) => (
                  <button
                    key={tpl.key}
                    onClick={() => changeTemplate(tpl.key as typeof pdfTemplate)}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      pdfTemplate === tpl.key
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <p className={`text-xs font-medium ${
                      pdfTemplate === tpl.key ? 'text-primary-700' : 'text-neutral-700'
                    }`}>{tpl.label}</p>
                    <p className="text-[10px] text-neutral-500">{tpl.desc}</p>
                  </button>
                ))}
              </div>
            </div>

          {/* Success banner */}
          {exportSuccess && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
              <CheckIcon className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">Export downloaded successfully!</p>
                <p className="text-xs text-green-600 mt-0.5">
                  Change any option above and click &quot;Generate New Export&quot; to export again with different settings.
                </p>
              </div>
            </div>
          )}

          {/* Preview of exported content */}
          {exportedContent && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Preview</label>
              <pre className="bg-neutral-50 rounded-lg p-3 text-xs text-neutral-700 
                            max-h-48 overflow-y-auto border border-neutral-200 whitespace-pre-wrap">
                {exportedContent.slice(0, 2000)}
                {exportedContent.length > 2000 && '\n\n... (truncated)'}
              </pre>
            </div>
          )}
          {/* Export History */}
          <ExportHistory sessionId={sessionId} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 
                       rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className={`px-6 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2 ${
              exportSuccess
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-primary-600 hover:bg-primary-700'
            }`}
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : exportSuccess ? (
              <>
                <DocumentArrowDownIcon className="w-4 h-4" />
                Generate New Export
              </>
            ) : (
              <>
                <DocumentArrowDownIcon className="w-4 h-4" />
                Export &amp; Download
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
