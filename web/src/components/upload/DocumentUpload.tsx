"use client";

import { useState } from "react";
import {
  DocumentTextIcon,
  CloudArrowUpIcon,
  SparklesIcon,
  ArrowRightIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { uploadDocument } from "@/lib/api";

interface DocumentUploadProps {
  sessionId: string;
  onUpload: (filename?: string) => void;
}

export default function DocumentUpload({ sessionId, onUpload }: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      await uploadFile(file);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
    }
  };

  const uploadFile = async (file: File) => {
    try {
      setIsUploading(true);
      setError(null);

      await uploadDocument(sessionId, file);

      const { default: api } = await import("@/lib/api");
      const sessionResponse = await api.get(`/api/sessions/${sessionId}`);
      const actualFilename = sessionResponse.data.document_filename;

      onUpload(actualFilename || file.name);
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        "Failed to upload document";
      setError(errorMessage);
      console.error("Upload error:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleTextSubmit = async () => {
    if (textInput.trim()) {
      try {
        setIsUploading(true);
        setError(null);

        const blob = new Blob([textInput], { type: "text/plain" });
        const file = new File([blob], "Text Requirements.txt", {
          type: "text/plain",
        });
        await uploadDocument(sessionId, file);

        const { default: api } = await import("@/lib/api");
        const sessionResponse = await api.get(`/api/sessions/${sessionId}`);
        const actualFilename = sessionResponse.data.document_filename;

        onUpload(actualFilename || "Text Requirements");
      } catch (err: any) {
        setError(
          err.response?.data?.error ||
            err.response?.data?.detail ||
            "Failed to process text"
        );
        console.error("Upload error:", err);
      } finally {
        setIsUploading(false);
      }
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
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-100 text-primary-700 rounded-full text-sm font-medium mb-4">
          <SparklesIcon className="w-4 h-4" />
          Step 1 of 3
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 mb-3">
          What are you building?
        </h1>
        <p className="text-neutral-500 text-base max-w-md mx-auto">
          Upload a document or describe your project idea to get started
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-danger-50 border border-danger-200 rounded-xl text-danger-700 text-sm animate-fade-in">
          {error}
        </div>
      )}

      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 ${
          isDragging
            ? "border-primary-500 bg-primary-50/50 scale-[1.02]"
            : "border-neutral-200 bg-white hover:border-primary-300 hover:bg-neutral-50/50"
        }`}
      >
        <div
          className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 ${
            isDragging
              ? "bg-primary-100 scale-110"
              : "bg-neutral-100"
          }`}
        >
          <CloudArrowUpIcon
            className={`w-8 h-8 transition-colors ${
              isDragging ? "text-primary-600" : "text-neutral-400"
            }`}
          />
        </div>

        <h3 className="text-lg font-semibold text-neutral-900 mb-1">
          {isDragging ? "Drop your file here" : "Drag and drop your document"}
        </h3>
        <p className="text-sm text-neutral-500 mb-6">
          PDF, Word, or Text files up to 10MB
        </p>

        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept=".pdf,.doc,.docx,.txt"
          onChange={handleFileSelect}
        />
        <label
          htmlFor="file-upload"
          className="btn-primary cursor-pointer inline-flex"
        >
          Browse Files
        </label>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 my-8">
        <div className="flex-1 divider"></div>
        <span className="text-sm text-neutral-400 font-medium px-2">or describe it</span>
        <div className="flex-1 divider"></div>
      </div>

      {/* Text Input */}
      <div className="card p-6">
        <label className="block text-sm font-medium text-neutral-700 mb-3">
          Describe what you want to build
        </label>
        <textarea
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Example: I want to build a customer support chatbot that can handle FAQs, escalate complex issues to humans, and integrate with our existing CRM system..."
          className="input min-h-[140px] resize-none"
        />
        <div className="flex justify-end mt-4">
          <button
            onClick={handleTextSubmit}
            disabled={!textInput.trim() || isUploading}
            className="btn-primary"
          >
            {isUploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Processing...
              </>
            ) : (
              <>
                Continue
                <ArrowRightIcon className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Quick Examples */}
      <div className="mt-6">
        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
          Quick examples
        </p>
        <div className="flex flex-wrap gap-2">
          {examples.map((example, idx) => (
            <button
              key={idx}
              onClick={() => setTextInput(example)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 bg-white border border-neutral-200 rounded-xl hover:border-primary-300 hover:bg-primary-50/50 hover:text-primary-700 transition-all duration-200"
            >
              <DocumentTextIcon className="w-4 h-4 text-neutral-400" />
              <span className="truncate max-w-[200px]">{example}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
