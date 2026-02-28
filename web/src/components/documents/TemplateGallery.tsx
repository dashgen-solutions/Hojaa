'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  XMarkIcon,
  DocumentTextIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import type { DocumentTemplate } from '@/lib/api';
import { getDocumentTemplates } from '@/lib/api';

interface TemplateGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (templateId: string) => void;
}

const CATEGORIES = ['All', 'Proposal', 'Contract', 'SOW', 'NDA', 'Invoice'] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_BADGE: Record<string, { bg: string; text: string }> = {
  proposal: { bg: 'bg-blue-100', text: 'text-blue-700' },
  contract: { bg: 'bg-purple-100', text: 'text-purple-700' },
  sow: { bg: 'bg-amber-100', text: 'text-amber-700' },
  nda: { bg: 'bg-red-100', text: 'text-red-700' },
  invoice: { bg: 'bg-green-100', text: 'text-green-700' },
};

function SkeletonTemplateCard() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 animate-pulse">
      <div className="h-5 w-2/3 bg-neutral-200 rounded mb-2" />
      <div className="h-4 w-full bg-neutral-100 rounded mb-1" />
      <div className="h-4 w-1/2 bg-neutral-100 rounded mb-4" />
      <div className="h-3 w-16 bg-neutral-100 rounded" />
    </div>
  );
}

export default function TemplateGallery({ isOpen, onClose, onSelect }: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>('All');

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setError(null);
    getDocumentTemplates()
      .then(setTemplates)
      .catch((err) => {
        console.error('Failed to load templates:', err);
        setError('Failed to load templates. Please try again.');
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (activeCategory === 'All') return templates;
    return templates.filter(
      (t) => t.category?.toLowerCase() === activeCategory.toLowerCase(),
    );
  }, [templates, activeCategory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-3xl max-h-[80vh] rounded-xl border border-neutral-200 bg-white shadow-2xl flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Template Gallery</h2>
            <p className="text-sm text-neutral-500 mt-0.5">
              Choose a template to get started quickly
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-neutral-100 transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-neutral-500" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 px-6 pt-4 pb-2 border-b border-neutral-100">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-4">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonTemplateCard key={i} />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <DocumentTextIcon className="h-10 w-10 text-neutral-300 mb-3" />
              <p className="text-sm font-medium text-neutral-900 mb-1">No templates found</p>
              <p className="text-sm text-neutral-500">
                {activeCategory !== 'All'
                  ? `No templates in the "${activeCategory}" category.`
                  : 'No templates available yet.'}
              </p>
            </div>
          )}

          {/* Template Grid */}
          {!loading && !error && filtered.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((template) => {
                const catKey = template.category?.toLowerCase() || '';
                const catBadge = CATEGORY_BADGE[catKey] || {
                  bg: 'bg-neutral-100',
                  text: 'text-neutral-600',
                };

                return (
                  <div
                    key={template.id}
                    className="rounded-lg border border-neutral-200 bg-white p-5 hover:border-neutral-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <SparklesIcon className="h-4 w-4 text-neutral-400 flex-shrink-0" />
                        <h3 className="text-sm font-medium text-neutral-900">
                          {template.name}
                        </h3>
                      </div>
                      {template.category && (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${catBadge.bg} ${catBadge.text}`}
                        >
                          {template.category}
                        </span>
                      )}
                    </div>

                    {template.description && (
                      <p className="text-sm text-neutral-500 mb-4 line-clamp-2">
                        {template.description}
                      </p>
                    )}

                    {!template.description && (
                      <p className="text-sm text-neutral-400 mb-4 italic">
                        No description provided
                      </p>
                    )}

                    <button
                      onClick={() => onSelect(template.id)}
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      Use Template
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
