"use client";

import { useState, useRef } from "react";
import {
  DocumentTextIcon,
  CloudArrowUpIcon,
  SparklesIcon,
  ArrowRightIcon,
  XMarkIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { uploadDocument } from "@/lib/api";

interface DocumentUploadProps {
  sessionId: string;
  onUpload: (filename?: string) => void;
}

interface UploadedFile {
  name: string;
  size: number;
  status: "pending" | "uploading" | "done" | "error";
  file: File;
  error?: string;
}

export default function DocumentUpload({ sessionId, onUpload }: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasFiles = uploadedFiles.length > 0;
  const hasText = textInput.trim().length > 0;
  const canProceed = hasFiles || hasText;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const addFiles = (files: File[]) => {
    const validExtensions = [".pdf", ".doc", ".docx", ".txt"];
    const maxSize = 10 * 1024 * 1024;

    const newFiles: UploadedFile[] = [];
    for (const file of files) {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!validExtensions.includes(ext)) {
        setError(`"${file.name}" is not supported. Use PDF, Word, or Text files.`);
        continue;
      }
      if (file.size > maxSize) {
        setError(`"${file.name}" exceeds the 10MB limit.`);
        continue;
      }
      if (uploadedFiles.some((f) => f.name === file.name) || newFiles.some((f) => f.name === file.name)) {
        continue;
      }
      newFiles.push({ name: file.name, size: file.size, status: "pending", file });
    }

    if (newFiles.length > 0) {
      setUploadedFiles((prev) => [...prev, ...newFiles]);
      setError(null);
    }
  };

  const removeFile = (name: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleProceed = async () => {
    if (!canProceed) return;
    setIsProcessing(true);
    setError(null);

    try {
      if (hasText) {
        const blob = new Blob([textInput], { type: "text/plain" });
        const textFile = new File([blob], "Text Requirements.txt", { type: "text/plain" });
        await uploadDocument(sessionId, textFile);
      }

      for (let i = 0; i < uploadedFiles.length; i++) {
        const uf = uploadedFiles[i];
        setUploadedFiles((prev) =>
          prev.map((f) => (f.name === uf.name ? { ...f, status: "uploading" } : f))
        );
        try {
          await uploadDocument(sessionId, uf.file);
          setUploadedFiles((prev) =>
            prev.map((f) => (f.name === uf.name ? { ...f, status: "done" } : f))
          );
        } catch (err: any) {
          const msg = err.response?.data?.error || err.response?.data?.detail || "Upload failed";
          setUploadedFiles((prev) =>
            prev.map((f) => (f.name === uf.name ? { ...f, status: "error", error: msg } : f))
          );
        }
      }

      const { default: api } = await import("@/lib/api");
      const sessionResponse = await api.get(`/api/sessions/${sessionId}`);
      const actualFilename = sessionResponse.data.document_filename;
      onUpload(actualFilename || (hasFiles ? uploadedFiles[0].name : "Text Requirements"));
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.detail || "Failed to process input");
    } finally {
      setIsProcessing(false);
    }
  };

  const examples = [
    "I want to build a mobile app for food delivery",
    "We need an e-commerce platform with payment integration",
    "Build a chatbot for customer support with AI capabilities",
  ];

  return (
    <div className="max-w-2xl w-full animate-fade-in-up">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-full text-sm font-medium mb-4">
          <SparklesIcon className="w-4 h-4" />
          Step 1 of 3
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
          What are you building?
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 text-base max-w-md mx-auto">
          Upload documents, describe your idea, or both — then proceed
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-danger-50 border border-danger-200 rounded-md text-danger-700 text-sm animate-fade-in flex items-start gap-2">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-danger-400 hover:text-danger-600">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-md p-8 text-center transition-all duration-300 ${
          isDragging
            ? "border-neutral-400 dark:border-neutral-500 bg-neutral-50 dark:bg-neutral-800 scale-[1.02]"
            : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-800"
        }`}
      >
        <div
          className={`w-14 h-14 mx-auto rounded-md flex items-center justify-center mb-3 transition-all ${
            isDragging ? "bg-neutral-100 dark:bg-neutral-700 scale-110" : "bg-neutral-100 dark:bg-neutral-800"
          }`}
        >
          <CloudArrowUpIcon
            className={`w-7 h-7 transition-colors ${
              isDragging ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-400 dark:text-neutral-500"
            }`}
          />
        </div>

        <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
          {isDragging ? "Drop files here" : "Drag & drop documents"}
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
          PDF, Word, or Text — multiple files supported, up to 10MB each
        </p>

        <input
          ref={fileInputRef}
          type="file"
          id="file-upload"
          className="hidden"
          accept=".pdf,.doc,.docx,.txt"
          onChange={handleFileSelect}
          multiple
        />
        <label htmlFor="file-upload" className="btn-primary cursor-pointer inline-flex">
          <PlusIcon className="w-4 h-4" />
          Browse Files
        </label>
      </div>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploadedFiles.map((uf) => (
            <div
              key={uf.name}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-md border transition-colors ${
                uf.status === "done"
                  ? "bg-success-50/50 border-success-200 dark:bg-success-900/20 dark:border-success-800"
                  : uf.status === "error"
                  ? "bg-danger-50/50 border-danger-200 dark:bg-danger-900/20 dark:border-danger-800"
                  : uf.status === "uploading"
                  ? "bg-blue-50/50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800"
                  : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700"
              }`}
            >
              <DocumentTextIcon className="w-5 h-5 text-neutral-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{uf.name}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {formatFileSize(uf.size)}
                  {uf.status === "uploading" && " — Uploading..."}
                  {uf.status === "done" && " — Done"}
                  {uf.status === "error" && ` — ${uf.error}`}
                </p>
              </div>
              {uf.status === "uploading" && (
                <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
              )}
              {(uf.status === "pending" || uf.status === "error") && (
                <button onClick={() => removeFile(uf.name)} className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 divider"></div>
        <span className="text-sm text-neutral-400 dark:text-neutral-500 font-medium px-2">
          {hasFiles ? "and / or describe it" : "or describe it"}
        </span>
        <div className="flex-1 divider"></div>
      </div>

      {/* Text Input */}
      <div className="card p-6">
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
          Describe what you want to build
        </label>
        <textarea
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Example: I want to build a customer support chatbot that can handle FAQs, escalate complex issues to humans, and integrate with our existing CRM system..."
          className="input min-h-[120px] resize-none"
        />
      </div>

      {/* Quick Examples */}
      <div className="mt-4">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Quick examples</p>
        <div className="flex flex-wrap gap-2">
          {examples.map((example, idx) => (
            <button
              key={idx}
              onClick={() => setTextInput(example)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 dark:text-neutral-400 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-md hover:border-neutral-300 dark:hover:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 transition-all duration-200"
            >
              <DocumentTextIcon className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
              <span className="truncate max-w-[200px]">{example}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Proceed Button */}
      <div className="mt-8">
        <button
          onClick={handleProceed}
          disabled={!canProceed || isProcessing}
          className="w-full btn bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-brand-lime dark:text-brand-dark dark:hover:bg-brand-lime/90 py-4 text-base font-semibold shadow-sm hover:shadow transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              Processing...
            </>
          ) : (
            <>
              Continue
              <ArrowRightIcon className="w-5 h-5" />
            </>
          )}
        </button>
        {!canProceed && (
          <p className="text-center text-xs text-neutral-400 dark:text-neutral-500 mt-2">
            Upload at least one document or enter a text description to continue
          </p>
        )}
      </div>
    </div>
  );
}
