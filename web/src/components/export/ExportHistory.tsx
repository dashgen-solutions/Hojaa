'use client';

import { useState, useEffect } from 'react';
import {
  ClockIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  DocumentArrowDownIcon,
  TrashIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useStore } from '@/stores/useStore';

interface ExportRecord {
  id: string;
  sessionId: string;
  format: 'markdown' | 'json' | 'pdf';
  options: Record<string, any>;
  timestamp: string;
  filename: string;
}

const FORMAT_META: Record<string, { label: string; icon: typeof DocumentTextIcon; color: string }> = {
  markdown: { label: 'Markdown', icon: DocumentTextIcon, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  json: { label: 'JSON', icon: CodeBracketIcon, color: 'bg-amber-50 text-amber-700 border-amber-200' },
  pdf: { label: 'PDF', icon: DocumentArrowDownIcon, color: 'bg-red-50 text-red-700 border-red-200' },
};

const STORAGE_KEY = 'mometric_export_history';

function getHistory(): ExportRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(records: ExportRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 50))); // keep last 50
}

/** Call this after a successful export to record it. */
export function recordExport(sessionId: string, format: string, options: Record<string, any>, filename: string) {
  const record: ExportRecord = {
    id: crypto.randomUUID(),
    sessionId,
    format: format as ExportRecord['format'],
    options,
    timestamp: new Date().toISOString(),
    filename,
  };
  const history = getHistory();
  history.unshift(record);
  saveHistory(history);
}

interface ExportHistoryProps {
  sessionId: string;
}

export default function ExportHistory({ sessionId }: ExportHistoryProps) {
  const [records, setRecords] = useState<ExportRecord[]>([]);
  const [reExporting, setReExporting] = useState<string | null>(null);
  const { downloadMarkdown, downloadJson, downloadPdf } = useStore();

  useEffect(() => {
    const all = getHistory().filter((r) => r.sessionId === sessionId);
    setRecords(all);
  }, [sessionId]);

  const handleReExport = async (record: ExportRecord) => {
    setReExporting(record.id);
    try {
      const opts = { ...record.options, session_id: sessionId };
      if (record.format === 'pdf') {
        const blob = await downloadPdf(opts);
        triggerDownload(blob, record.filename);
      } else if (record.format === 'json') {
        const content = await downloadJson(opts);
        triggerDownload(new Blob([content], { type: 'application/json' }), record.filename);
      } else {
        const content = await downloadMarkdown(opts);
        triggerDownload(new Blob([content], { type: 'text/markdown' }), record.filename);
      }
    } catch (err) {
      console.error('Re-export failed:', err);
      alert('Re-export failed. Please try again.');
    } finally {
      setReExporting(null);
    }
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClear = (id: string) => {
    const all = getHistory().filter((r) => r.id !== id);
    saveHistory(all);
    setRecords(all.filter((r) => r.sessionId === sessionId));
  };

  if (records.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-neutral-400">
        <ClockIcon className="w-6 h-6 mx-auto mb-2 text-neutral-300" />
        No exports yet for this project.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
        <ClockIcon className="w-3.5 h-3.5" />
        Export History
      </h4>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {records.map((record) => {
          const meta = FORMAT_META[record.format] || FORMAT_META.markdown;
          const FormatIcon = meta.icon;
          const date = new Date(record.timestamp);
          return (
            <div
              key={record.id}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-neutral-200 bg-neutral-50 hover:bg-white transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${meta.color}`}>
                  <FormatIcon className="w-3 h-3 inline mr-0.5" />
                  {meta.label}
                </span>
                <span className="text-xs text-neutral-600 truncate">{record.filename}</span>
                <span className="text-[10px] text-neutral-400 flex-shrink-0">
                  {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleReExport(record)}
                  disabled={reExporting === record.id}
                  className="p-1 rounded hover:bg-neutral-100 text-neutral-900 disabled:opacity-50"
                  title="Re-download"
                >
                  <ArrowPathIcon className={`w-3.5 h-3.5 ${reExporting === record.id ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => handleClear(record.id)}
                  className="p-1 rounded hover:bg-red-50 text-neutral-400 hover:text-red-500"
                  title="Remove from history"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
