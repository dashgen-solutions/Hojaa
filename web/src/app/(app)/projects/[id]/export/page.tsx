"use client";

import { useState } from "react";
import {
  DocumentTextIcon, CodeBracketIcon,
  DocumentArrowDownIcon, CheckIcon,
} from "@heroicons/react/24/outline";
import { useProject } from "@/contexts/ProjectContext";
import { useStore } from "@/stores/useStore";
import ExportHistory, { recordExport } from "@/components/export/ExportHistory";

const EXPORT_FORMATS = [
  { key: "markdown", label: "Markdown", description: "Clean formatted text document", icon: DocumentTextIcon },
  { key: "json", label: "JSON", description: "Structured data for integrations", icon: CodeBracketIcon },
  { key: "pdf", label: "PDF / HTML", description: "Formatted scope document", icon: DocumentArrowDownIcon },
];

export default function ExportPage() {
  const { projectId, isLoading: projectLoading } = useProject();
  const { downloadMarkdown, downloadJson, downloadPdf } = useStore();

  const [selectedFormat, setSelectedFormat] = useState("markdown");
  const [includeDeferred, setIncludeDeferred] = useState(false);
  const [includeChangeLog, setIncludeChangeLog] = useState(false);
  const [includeAssignments, setIncludeAssignments] = useState(false);
  const [includeSources, setIncludeSources] = useState(false);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [includeConversations, setIncludeConversations] = useState(false);
  const [detailLevel, setDetailLevel] = useState<"summary" | "detailed" | "full">("detailed");
  const [pdfTemplate, setPdfTemplate] = useState<"standard" | "executive" | "technical">("standard");
  const [isExporting, setIsExporting] = useState(false);
  const [exportedContent, setExportedContent] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  const clearPreviousExport = () => {
    if (exportedContent || exportSuccess) {
      setExportedContent(null);
      setExportSuccess(false);
    }
  };

  const triggerFileDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    setExportedContent(null);
    setExportSuccess(false);
    setIsExporting(true);
    try {
      const exportOptions = {
        session_id: projectId,
        include_deferred: includeDeferred,
        include_change_log: includeChangeLog,
        include_assignments: includeAssignments,
        include_sources: includeSources,
        include_completed: includeCompleted,
        include_conversations: includeConversations,
        detail_level: detailLevel,
        template: pdfTemplate,
      };

      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

      if (selectedFormat === "pdf") {
        const previewContent = await downloadMarkdown(exportOptions);
        setExportedContent(previewContent);
        const pdfBlob = await downloadPdf(exportOptions);
        const filename = `scope_document_${ts}.pdf`;
        triggerFileDownload(pdfBlob, filename);
        recordExport(projectId, "pdf", exportOptions, filename);
      } else if (selectedFormat === "json") {
        const content = await downloadJson(exportOptions);
        setExportedContent(content);
        const filename = `scope_document_${ts}.json`;
        const blob = new Blob([content], { type: "application/json" });
        triggerFileDownload(blob, filename);
        recordExport(projectId, "json", exportOptions, filename);
      } else {
        const content = await downloadMarkdown(exportOptions);
        setExportedContent(content);
        const filename = `scope_document_${ts}.md`;
        const blob = new Blob([content], { type: "text/markdown" });
        triggerFileDownload(blob, filename);
        recordExport(projectId, "markdown", exportOptions, filename);
      }
      setExportSuccess(true);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-3 border-neutral-200 border-t-neutral-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold text-neutral-900 mb-6">Export Scope Document</h1>

        <div className="space-y-5">
          {/* Format selection */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Format</label>
            <div className="grid grid-cols-3 gap-3">
              {EXPORT_FORMATS.map((format) => (
                <button
                  key={format.key}
                  onClick={() => { setSelectedFormat(format.key); clearPreviousExport(); }}
                  className={`p-3 rounded-md border-2 text-left transition-all ${
                    selectedFormat === format.key
                      ? "border-neutral-200 bg-neutral-50"
                      : "border-neutral-200 hover:border-neutral-300"
                  }`}
                >
                  <format.icon className={`w-5 h-5 mb-1 ${
                    selectedFormat === format.key ? "text-neutral-900" : "text-neutral-400"
                  }`} />
                  <p className={`text-sm font-medium ${
                    selectedFormat === format.key ? "text-neutral-900" : "text-neutral-700"
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
                { label: "Deferred items", desc: "Items pushed to later phases", value: includeDeferred, toggle: () => { setIncludeDeferred(v => !v); clearPreviousExport(); } },
                { label: "Change log", desc: "History of all scope changes", value: includeChangeLog, toggle: () => { setIncludeChangeLog(v => !v); clearPreviousExport(); } },
                { label: "Team assignments", desc: "Who is working on what", value: includeAssignments, toggle: () => { setIncludeAssignments(v => !v); clearPreviousExport(); } },
                { label: "Sources", desc: "Meeting notes, documents & origins", value: includeSources, toggle: () => { setIncludeSources(v => !v); clearPreviousExport(); } },
                { label: "Completed items", desc: "Items marked as done", value: includeCompleted, toggle: () => { setIncludeCompleted(v => !v); clearPreviousExport(); } },
                { label: "Conversations", desc: "Chat history for each node", value: includeConversations, toggle: () => { setIncludeConversations(v => !v); clearPreviousExport(); } },
              ].map((option) => (
                <label
                  key={option.label}
                  className="flex items-center gap-3 p-3 rounded hover:bg-neutral-50 cursor-pointer"
                >
                  <div className="relative">
                    <input type="checkbox" checked={option.value} onChange={option.toggle} className="sr-only" />
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                      option.value ? "bg-neutral-900 border-neutral-900" : "border-neutral-300"
                    }`}>
                      {option.value && <CheckIcon className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-800">{option.label}</p>
                    <p className="text-xs text-neutral-500">{option.desc}</p>
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
              onChange={(e) => { setDetailLevel(e.target.value as typeof detailLevel); clearPreviousExport(); }}
              className="w-full px-3 py-2 rounded border border-neutral-200 text-sm text-neutral-800 bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-neutral-400"
            >
              <option value="summary">Summary - titles only</option>
              <option value="detailed">Detailed - titles & descriptions</option>
              <option value="full">Full - everything incl. acceptance criteria</option>
            </select>
          </div>

          {/* Template */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Document Template</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "standard", label: "Standard", desc: "Full scope document" },
                { key: "executive", label: "Executive", desc: "High-level summary" },
                { key: "technical", label: "Technical", desc: "Detailed with AC & hours" },
              ].map((tpl) => (
                <button
                  key={tpl.key}
                  onClick={() => { setPdfTemplate(tpl.key as typeof pdfTemplate); clearPreviousExport(); }}
                  className={`p-2 rounded border text-left transition-all ${
                    pdfTemplate === tpl.key
                      ? "border-neutral-200 bg-neutral-50"
                      : "border-neutral-200 hover:border-neutral-300"
                  }`}
                >
                  <p className={`text-xs font-medium ${
                    pdfTemplate === tpl.key ? "text-neutral-900" : "text-neutral-700"
                  }`}>{tpl.label}</p>
                  <p className="text-[10px] text-neutral-500">{tpl.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Success banner */}
          {exportSuccess && (
            <div className="flex items-center gap-3 p-3 rounded bg-green-50 border border-green-200">
              <CheckIcon className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">Export downloaded successfully!</p>
                <p className="text-xs text-green-600 mt-0.5">
                  Change any option above and click &quot;Generate New Export&quot; to export again.
                </p>
              </div>
            </div>
          )}

          {/* Preview */}
          {exportedContent && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Preview</label>
              <pre className="bg-neutral-50 rounded p-3 text-xs text-neutral-700 max-h-48 overflow-y-auto border border-neutral-200 whitespace-pre-wrap">
                {exportedContent.slice(0, 2000)}
                {exportedContent.length > 2000 && "\n\n... (truncated)"}
              </pre>
            </div>
          )}

          {/* Export History */}
          <ExportHistory sessionId={projectId} />

          {/* Export button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className={`px-6 py-2 text-sm font-medium text-white rounded transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2 ${
                exportSuccess ? "bg-green-600 hover:bg-green-700" : "bg-neutral-900 hover:bg-neutral-800"
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
    </div>
  );
}
