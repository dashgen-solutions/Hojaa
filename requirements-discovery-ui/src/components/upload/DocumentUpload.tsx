"use client";

import { useState } from "react";
import { DocumentTextIcon, CloudArrowUpIcon } from "@heroicons/react/24/outline";
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
      
      console.log("Uploading file:", file.name, "Type:", file.type, "Size:", file.size);
      
      await uploadDocument(sessionId, file);
      
      // Fetch the actual filename saved by backend
      const { default: api } = await import("@/lib/api");
      const sessionResponse = await api.get(`/api/sessions/${sessionId}`);
      const actualFilename = sessionResponse.data.document_filename;
      
      console.log("Upload successful, filename:", actualFilename);
      onUpload(actualFilename || file.name);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.response?.data?.detail || "Failed to upload document";
      setError(errorMessage);
      console.error("Upload error:", err);
      console.error("Error response:", err.response?.data);
    } finally {
      setIsUploading(false);
    }
  };

  const handleTextSubmit = async () => {
    if (textInput.trim()) {
      try {
        setIsUploading(true);
        setError(null);
        
        // Create a text file from the input with .txt extension
        const blob = new Blob([textInput], { type: 'text/plain' });
        const file = new File([blob], 'Text Requirements.txt', { type: 'text/plain' });
        await uploadDocument(sessionId, file);
        
        // Fetch the actual filename saved by backend
        const { default: api } = await import("@/lib/api");
        const sessionResponse = await api.get(`/api/sessions/${sessionId}`);
        const actualFilename = sessionResponse.data.document_filename;
        
        onUpload(actualFilename || 'Text Requirements');
      } catch (err: any) {
        setError(err.response?.data?.error || err.response?.data?.detail || "Failed to process text");
        console.error("Upload error:", err);
        console.error("Error details:", err.response?.data);
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <div className="max-w-3xl w-full p-8 my-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-secondary-900 mb-2">
          Start Your Requirements Discovery
        </h1>
        <p className="text-base md:text-lg text-secondary-600">
          Upload a vague document or describe what you want to build
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 md:p-12 text-center transition-all ${
          isDragging
            ? "border-primary-500 bg-primary-50"
            : "border-secondary-300 bg-white hover:border-primary-400"
        }`}
      >
        <CloudArrowUpIcon className="w-12 h-12 md:w-16 md:h-16 mx-auto text-secondary-400 mb-3 md:mb-4" />
        <h3 className="text-lg font-semibold text-secondary-900 mb-2">
          Drop your document here
        </h3>
        <p className="text-sm text-secondary-600 mb-6">
          PDF, Word, or Text files supported
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
          className="inline-block bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg cursor-pointer font-medium transition-colors"
        >
          Choose File
        </label>
      </div>

      {/* OR Divider */}
      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-secondary-200"></div>
        <span className="text-sm text-secondary-500 font-medium">OR</span>
        <div className="flex-1 h-px bg-secondary-200"></div>
      </div>

      {/* Text Input */}
      <div className="bg-white border border-secondary-200 rounded-xl p-4 md:p-6">
        <label className="block text-sm font-medium text-secondary-700 mb-3">
          Describe what you want to build
        </label>
        <textarea
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Example: I want to build a customer support chatbot that can handle FAQs, escalate complex issues to humans, and integrate with our existing CRM system..."
          className="w-full h-32 md:h-40 px-4 py-3 border border-secondary-200 rounded-lg text-sm text-secondary-900 placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
        />
        <div className="flex justify-end mt-4">
          <button
            onClick={handleTextSubmit}
            disabled={!textInput.trim() || isUploading}
            className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Uploading...
              </>
            ) : (
              "Continue →"
            )}
          </button>
        </div>
      </div>

      {/* Examples */}
      <div className="mt-6 bg-secondary-50 border border-secondary-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-secondary-700 mb-2">
          Example prompts:
        </h4>
        <div className="space-y-2">
          {[
            "I want to build a mobile app for food delivery",
            "We need an e-commerce platform with payment integration",
            "Build a chatbot for customer support with AI capabilities",
          ].map((example, idx) => (
            <button
              key={idx}
              onClick={() => setTextInput(example)}
              className="w-full text-left px-3 py-2 text-sm text-secondary-700 hover:bg-white hover:border-secondary-300 border border-transparent rounded-lg transition-all"
            >
              <DocumentTextIcon className="w-4 h-4 inline mr-2 text-secondary-400" />
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
