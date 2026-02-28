"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  PlusIcon,
  DocumentTextIcon,
  Squares2X2Icon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  getProjectDocuments,
  createDocument,
  getDocument,
  type ScopeDocument,
} from "@/lib/api";
import DocumentList from "@/components/documents/DocumentList";
import DocumentEditor from "@/components/documents/DocumentEditor";
import TemplateGallery from "@/components/documents/TemplateGallery";

export default function DocumentsPage() {
  const { projectId, isLoading: projectLoading } = useProject();
  const { isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [documents, setDocuments] = useState<ScopeDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<ScopeDocument | null>(null);
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creatingDoc, setCreatingDoc] = useState(false);

  const selectedDocId = searchParams.get("doc");

  // Fetch all project documents
  const fetchDocuments = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const docs = await getProjectDocuments(projectId);
      setDocuments(docs);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Fetch selected document when docId changes
  useEffect(() => {
    if (!selectedDocId) {
      setSelectedDoc(null);
      return;
    }

    let cancelled = false;

    const fetchSelectedDoc = async () => {
      try {
        const doc = await getDocument(selectedDocId);
        if (!cancelled) {
          setSelectedDoc(doc);
        }
      } catch (err) {
        console.error("Failed to fetch document:", err);
        if (!cancelled) {
          setSelectedDoc(null);
          router.replace(`/projects/${projectId}/documents`);
        }
      }
    };

    fetchSelectedDoc();

    return () => {
      cancelled = true;
    };
  }, [selectedDocId, projectId, router]);

  // Navigate to a document
  const navigateToDoc = useCallback(
    (docId: string) => {
      router.push(`/projects/${projectId}/documents?doc=${docId}`);
    },
    [projectId, router]
  );

  // Navigate back to list
  const navigateToList = useCallback(() => {
    router.push(`/projects/${projectId}/documents`);
    setSelectedDoc(null);
  }, [projectId, router]);

  // Create a blank document
  const handleCreateBlank = async () => {
    if (creatingDoc) return;
    try {
      setCreatingDoc(true);
      setShowNewMenu(false);
      const doc = await createDocument(projectId, { title: "Untitled Document" });
      setDocuments((prev) => [doc, ...prev]);
      navigateToDoc(doc.id);
    } catch (err) {
      console.error("Failed to create document:", err);
    } finally {
      setCreatingDoc(false);
    }
  };

  // Create from template
  const handleCreateFromTemplate = async (templateId: string) => {
    if (creatingDoc) return;
    try {
      setCreatingDoc(true);
      setShowTemplateGallery(false);
      const doc = await createDocument(projectId, { template_id: templateId });
      setDocuments((prev) => [doc, ...prev]);
      navigateToDoc(doc.id);
    } catch (err) {
      console.error("Failed to create document from template:", err);
    } finally {
      setCreatingDoc(false);
    }
  };

  // Handle document selection from list
  const handleSelectDocument = useCallback(
    (id: string) => {
      navigateToDoc(id);
    },
    [navigateToDoc]
  );

  // Handle document deletion
  const handleDocumentDelete = useCallback(
    (deletedDocId: string) => {
      setDocuments((prev) => prev.filter((d) => d.id !== deletedDocId));
      if (selectedDocId === deletedDocId) {
        navigateToList();
      }
    },
    [selectedDocId, navigateToList]
  );

  // Handle document duplication
  const handleDocumentDuplicate = useCallback(
    (docId: string) => {
      fetchDocuments();
    },
    [fetchDocuments]
  );

  // Handle title change from editor
  const handleTitleChange = useCallback(
    (title: string) => {
      if (selectedDoc) {
        const updated = { ...selectedDoc, title };
        setSelectedDoc(updated);
        setDocuments((prev) =>
          prev.map((d) => (d.id === updated.id ? updated : d))
        );
      }
    },
    [selectedDoc]
  );

  // Handle status change from editor
  const handleStatusChange = useCallback(
    (status: string) => {
      if (selectedDoc) {
        const updated = { ...selectedDoc, status };
        setSelectedDoc(updated);
        setDocuments((prev) =>
          prev.map((d) => (d.id === updated.id ? updated : d))
        );
      }
    },
    [selectedDoc]
  );

  // Loading state
  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-neutral-50">
        <div className="w-8 h-8 border-3 border-neutral-200 border-t-neutral-600 rounded-full animate-spin" />
      </div>
    );
  }

  // Editor view — selected document
  if (selectedDocId && selectedDoc) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <DocumentEditor
            document={selectedDoc}
            onBack={navigateToList}
            onTitleChange={handleTitleChange}
            onStatusChange={handleStatusChange}
          />
        </div>
      </div>
    );
  }

  // Loading selected doc
  if (selectedDocId && !selectedDoc) {
    return (
      <div className="flex items-center justify-center h-full bg-neutral-50">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-neutral-200 border-t-neutral-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-neutral-500">Loading document...</p>
        </div>
      </div>
    );
  }

  // List view — default
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center">
            <DocumentTextIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-neutral-900 leading-tight">Documents</h1>
            {!loading && (
              <p className="text-xs text-neutral-500">
                {documents.length} {documents.length === 1 ? 'document' : 'documents'}
              </p>
            )}
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowNewMenu((prev) => !prev)}
            disabled={creatingDoc}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            {creatingDoc ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <PlusIcon className="w-4 h-4" />
            )}
            New Document
            <ChevronDownIcon className="w-3 h-3 ml-0.5" />
          </button>

          {/* New document dropdown */}
          {showNewMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowNewMenu(false)}
              />
              <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-lg shadow-lg border border-neutral-200 z-20 py-1">
                <button
                  onClick={handleCreateBlank}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                    <DocumentTextIcon className="w-4 h-4 text-neutral-500" />
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">Blank Document</p>
                    <p className="text-xs text-neutral-500">Start from scratch</p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setShowNewMenu(false);
                    setShowTemplateGallery(true);
                  }}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                    <Squares2X2Icon className="w-4 h-4 text-neutral-500" />
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">From Template</p>
                    <p className="text-xs text-neutral-500">Use a pre-built template</p>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-3 border-neutral-200 border-t-neutral-600 rounded-full animate-spin" />
          </div>
        ) : (
          <DocumentList
            documents={documents}
            onSelect={handleSelectDocument}
            onNew={handleCreateBlank}
            onNewFromTemplate={() => setShowTemplateGallery(true)}
            onDuplicate={handleDocumentDuplicate}
            onDelete={handleDocumentDelete}
            loading={false}
          />
        )}
      </div>

      {/* Template Gallery Modal */}
      {showTemplateGallery && (
        <TemplateGallery
          isOpen={showTemplateGallery}
          onSelect={handleCreateFromTemplate}
          onClose={() => setShowTemplateGallery(false)}
        />
      )}
    </div>
  );
}
