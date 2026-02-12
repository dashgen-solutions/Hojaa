'use client';

import { useState } from 'react';
import {
  XMarkIcon, DocumentTextIcon, CodeBracketIcon,
  DocumentArrowDownIcon, CheckIcon,
} from '@heroicons/react/24/outline';
import { useStore } from '@/stores/useStore';

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
  const [isExporting, setIsExporting] = useState(false);
  const [exportedContent, setExportedContent] = useState<string | null>(null);

  const { downloadMarkdown, downloadJson, downloadPdf } = useStore();

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
    setIsExporting(true);
    try {
      const exportOptions = {
        session_id: sessionId,
        include_deferred: includeDeferred,
        include_change_log: includeChangeLog,
        include_assignments: includeAssignments,
      };

      if (selectedFormat === 'pdf') {
        // First, get markdown for preview
        const previewContent = await downloadMarkdown(exportOptions);
        setExportedContent(previewContent);

        // Then download the real PDF from backend
        const pdfBlob = await downloadPdf(exportOptions);
        triggerFileDownload(pdfBlob, 'scope_document.pdf');
      } else if (selectedFormat === 'json') {
        const content = await downloadJson(exportOptions);
        setExportedContent(content);
        const blob = new Blob([content], { type: 'application/json' });
        triggerFileDownload(blob, 'scope_document.json');
      } else {
        // Markdown (default)
        const content = await downloadMarkdown(exportOptions);
        setExportedContent(content);
        const blob = new Blob([content], { type: 'text/markdown' });
        triggerFileDownload(blob, 'scope_document.md');
      }
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
                  onClick={() => setSelectedFormat(format.key)}
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
                { key: 'deferred', label: 'Deferred items', description: 'Items pushed to later phases', value: includeDeferred, setter: setIncludeDeferred },
                { key: 'changelog', label: 'Change log', description: 'History of all scope changes', value: includeChangeLog, setter: setIncludeChangeLog },
                { key: 'assignments', label: 'Team assignments', description: 'Who is working on what', value: includeAssignments, setter: setIncludeAssignments },
              ].map((option) => (
                <label
                  key={option.key}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50 cursor-pointer"
                >
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={option.value}
                      onChange={() => option.setter(!option.value)}
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
            className="px-6 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 
                       rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <DocumentArrowDownIcon className="w-4 h-4" />
                Export & Download
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
