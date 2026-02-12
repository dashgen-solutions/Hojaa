'use client';

import { useState } from 'react';
import { XMarkIcon, DocumentTextIcon, ChatBubbleLeftRightIcon, PencilIcon } from '@heroicons/react/24/outline';
import { useStore } from '@/stores/useStore';

interface SourceInputModalProps {
  sessionId: string;
  onClose: () => void;
  onSourceAdded: () => void;
}

const SOURCE_TYPES = [
  { value: 'meeting', label: 'Meeting Notes', icon: ChatBubbleLeftRightIcon, description: 'Paste notes from a meeting' },
  { value: 'document', label: 'Document', icon: DocumentTextIcon, description: 'Add content from a document' },
  { value: 'manual', label: 'Manual Note', icon: PencilIcon, description: 'Write a scope note manually' },
];

export default function SourceInputModal({ sessionId, onClose, onSourceAdded }: SourceInputModalProps) {
  const [selectedType, setSelectedType] = useState('meeting');
  const [sourceName, setSourceName] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [attendees, setAttendees] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { submitSource } = useStore();

  const handleSubmit = async () => {
    if (!sourceName.trim() || !rawContent.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const sourceMetadata: Record<string, any> = {};
      if (meetingDate) sourceMetadata.date = meetingDate;
      if (attendees) sourceMetadata.attendees = attendees;

      await submitSource({
        session_id: sessionId,
        source_type: selectedType,
        source_name: sourceName,
        raw_content: rawContent,
        source_metadata: sourceMetadata,
      });

      onSourceAdded();
    } catch (submitError: any) {
      setError(submitError?.response?.data?.detail || 'Failed to process source. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">Add Source</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-100 transition-colors">
            <XMarkIcon className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Source Type Selection */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Source Type</label>
            <div className="grid grid-cols-3 gap-3">
              {SOURCE_TYPES.map((sourceType) => (
                <button
                  key={sourceType.value}
                  onClick={() => setSelectedType(sourceType.value)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    selectedType === sourceType.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <sourceType.icon className={`w-5 h-5 mb-1 ${
                    selectedType === sourceType.value ? 'text-primary-600' : 'text-neutral-400'
                  }`} />
                  <p className={`text-sm font-medium ${
                    selectedType === sourceType.value ? 'text-primary-700' : 'text-neutral-700'
                  }`}>{sourceType.label}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{sourceType.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Source Name */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder={selectedType === 'meeting' ? 'e.g., Sprint Planning - Jan 15' : 'e.g., Updated Requirements Doc'}
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:border-primary-500 
                         focus:ring-2 focus:ring-primary-200 outline-none text-sm"
            />
          </div>

          {/* Meeting-specific fields */}
          {selectedType === 'meeting' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Meeting Date</label>
                <input
                  type="date"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:border-primary-500 
                             focus:ring-2 focus:ring-primary-200 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Attendees</label>
                <input
                  type="text"
                  value={attendees}
                  onChange={(e) => setAttendees(e.target.value)}
                  placeholder="e.g., John, Sarah, Mike"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:border-primary-500 
                             focus:ring-2 focus:ring-primary-200 outline-none text-sm"
                />
              </div>
            </div>
          )}

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Content <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rawContent}
              onChange={(e) => setRawContent(e.target.value)}
              placeholder={
                selectedType === 'meeting'
                  ? 'Paste your meeting notes or transcript here...\n\nTip: You can paste directly from Otter, Fireflies, Google Meet notes, or any other note-taking tool.'
                  : 'Paste or type the content here...'
              }
              rows={10}
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:border-primary-500 
                         focus:ring-2 focus:ring-primary-200 outline-none text-sm resize-y"
            />
            <p className="text-xs text-neutral-400 mt-1">
              AI will analyze this content and suggest scope changes for your review.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 
                       rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !sourceName.trim() || !rawContent.trim()}
            className="px-6 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 
                       rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analyzing...
              </>
            ) : (
              'Analyze & Generate Suggestions'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
