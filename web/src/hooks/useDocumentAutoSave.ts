"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveDocumentContent } from "@/lib/api";

interface UseDocumentAutoSaveOptions {
  documentId: string | null;
  content: unknown[] | null;
  enabled?: boolean;
  debounceMs?: number;
  skipRef?: React.MutableRefObject<boolean>;
}

interface UseDocumentAutoSaveReturn {
  isSaving: boolean;
  lastSaved: Date | null;
  error: string | null;
  saveNow: () => Promise<void>;
}

export function useDocumentAutoSave({
  documentId,
  content,
  enabled = true,
  debounceMs = 2000,
  skipRef,
}: UseDocumentAutoSaveOptions): UseDocumentAutoSaveReturn {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<unknown[] | null>(content);
  const lastSavedContentRef = useRef<string>("");

  // Keep content ref in sync
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const doSave = useCallback(async () => {
    if (!documentId || !contentRef.current) return;

    // Skip this save cycle if flagged (e.g. AI auto-applied content already saved server-side)
    if (skipRef?.current) {
      skipRef.current = false;
      lastSavedContentRef.current = JSON.stringify(contentRef.current);
      return;
    }

    const contentStr = JSON.stringify(contentRef.current);
    // Skip if content hasn't actually changed
    if (contentStr === lastSavedContentRef.current) return;

    setIsSaving(true);
    setError(null);

    try {
      await saveDocumentContent(documentId, contentRef.current);
      lastSavedContentRef.current = contentStr;
      setLastSaved(new Date());
    } catch (err) {
      console.error("Auto-save failed:", err);
      setError("Failed to save");
    } finally {
      setIsSaving(false);
    }
  }, [documentId]);

  // Debounced auto-save when content changes
  useEffect(() => {
    if (!enabled || !documentId || !content) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      doSave();
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, enabled, documentId, debounceMs, doSave]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { isSaving, lastSaved, error, saveNow: doSave };
}
