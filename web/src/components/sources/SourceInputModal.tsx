'use client';

import { useState, useRef } from 'react';
import {
  XMarkIcon, DocumentTextIcon, ChatBubbleLeftRightIcon,
  PencilIcon, EnvelopeIcon, HashtagIcon,
  ArrowUpTrayIcon, DocumentArrowUpIcon,
} from '@heroicons/react/24/outline';
import { useStore } from '@/stores/useStore';

interface SourceInputModalProps {
  sessionId: string;
  onClose: () => void;
  onSourceAdded: () => void;
}

// ===== Source Type Options =====

const SOURCE_TYPES = [
  {
    value: 'meeting',
    label: 'Meeting Notes',
    icon: ChatBubbleLeftRightIcon,
    description: 'Transcript or notes from a meeting',
  },
  {
    value: 'email',
    label: 'Email Thread',
    icon: EnvelopeIcon,
    description: 'Paste an email conversation thread',
  },
  {
    value: 'slack',
    label: 'Slack / Chat',
    icon: HashtagIcon,
    description: 'Slack or chat conversation export',
  },
  {
    value: 'document',
    label: 'Document',
    icon: DocumentTextIcon,
    description: 'Paste content from a document',
  },
  {
    value: 'manual',
    label: 'Manual Note',
    icon: PencilIcon,
    description: 'Write a scope note manually',
  },
];

// ===== Source Format Options (for meeting type) =====

const TRANSCRIPT_FORMATS = [
  { value: 'raw', label: 'Generic / Raw text' },
  { value: 'otter', label: 'Otter.ai transcript' },
  { value: 'fireflies', label: 'Fireflies.ai transcript' },
];

// ===== Meeting Type Options =====

const MEETING_TYPES = [
  { value: '', label: 'Select meeting type (optional)' },
  { value: 'sprint_planning', label: 'Sprint Planning' },
  { value: 'standup', label: 'Standup / Daily Sync' },
  { value: 'retrospective', label: 'Retrospective' },
  { value: 'client_review', label: 'Client Review' },
  { value: 'kickoff', label: 'Project Kickoff' },
  { value: 'brainstorm', label: 'Brainstorming Session' },
  { value: 'design_review', label: 'Design Review' },
  { value: 'technical_discussion', label: 'Technical Discussion' },
  { value: 'stakeholder_update', label: 'Stakeholder Update' },
  { value: 'other', label: 'Other' },
];

// ===== Input Mode Tabs =====

type InputMode = 'paste' | 'upload';

export default function SourceInputModal({ sessionId, onClose, onSourceAdded }: SourceInputModalProps) {
  // Form state
  const [selectedType, setSelectedType] = useState('meeting');
  const [sourceFormat, setSourceFormat] = useState('raw');
  const [sourceName, setSourceName] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [attendees, setAttendees] = useState('');
  const [meetingType, setMeetingType] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('paste');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { submitSource, uploadSourceFile } = useStore();

  // Determine the effective format based on source type
  const getEffectiveFormat = (): string => {
    if (selectedType === 'email') return 'email';
    if (selectedType === 'slack') return 'slack';
    if (selectedType === 'meeting') return sourceFormat;
    return 'raw';
  };

  // Show transcript format picker only for meeting type
  const showFormatPicker = selectedType === 'meeting';

  // Show meeting-specific metadata fields
  const showMeetingMetadata = selectedType === 'meeting';

  // Placeholder text based on selected type
  const getPlaceholder = (): string => {
    switch (selectedType) {
      case 'meeting':
        if (sourceFormat === 'otter')
          return 'Paste your Otter.ai transcript here...\n\nExpected format:\nSpeaker Name  0:00\nText spoken by the speaker.\n\nAnother Speaker  0:15\nMore text here.';
        if (sourceFormat === 'fireflies')
          return 'Paste your Fireflies.ai transcript here...\n\nExpected format:\nSpeaker Name (00:00:15)\nText spoken by the speaker.';
        return 'Paste your meeting notes or transcript here...\n\nTip: For best results, select the transcript format above if you\'re using Otter.ai or Fireflies.ai.';
      case 'email':
        return 'Paste the email thread here...\n\nExpected format:\nFrom: sender@example.com\nTo: recipient@example.com\nSubject: Re: Project discussion\nDate: Jan 15, 2026\n\nEmail body text...';
      case 'slack':
        return 'Paste the Slack conversation here...\n\nSupported formats:\n1. Text copy-paste (username  10:30 AM)\n2. JSON export from Slack';
      case 'document':
        return 'Paste the document content here...';
      case 'manual':
        return 'Write your scope note here...\n\nDescribe any scope changes, new requirements, or decisions that should be tracked.';
      default:
        return 'Paste or type the content here...';
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Auto-fill source name from filename if empty
      if (!sourceName) {
        const nameWithoutExtension = file.name.replace(/\.[^/.]+$/, '');
        setSourceName(nameWithoutExtension);
      }
    }
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!sourceName.trim()) {
      setError('Please provide a name for this source.');
      return;
    }

    if (inputMode === 'paste' && !rawContent.trim()) {
      setError('Please paste or type the content.');
      return;
    }

    if (inputMode === 'upload' && !selectedFile) {
      setError('Please select a file to upload.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      if (inputMode === 'upload' && selectedFile) {
        // File upload path
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('session_id', sessionId);
        formData.append('source_name', sourceName);
        formData.append('source_type', selectedType);
        formData.append('source_format', getEffectiveFormat());
        if (meetingType) formData.append('meeting_type', meetingType);
        if (meetingDate) formData.append('meeting_date', meetingDate);
        if (attendees) formData.append('attendees', attendees);

        await uploadSourceFile(formData, sessionId);
      } else {
        // Text paste path
        const sourceMetadata: Record<string, any> = {};
        if (meetingDate) sourceMetadata.date = meetingDate;
        if (attendees) sourceMetadata.attendees = attendees;

        await submitSource({
          session_id: sessionId,
          source_type: selectedType,
          source_format: getEffectiveFormat(),
          source_name: sourceName,
          raw_content: rawContent,
          meeting_type: meetingType || undefined,
          source_metadata: sourceMetadata,
        });
      }

      onSourceAdded();
    } catch (submitError: any) {
      setError(submitError?.response?.data?.detail || 'Failed to process source. Please try again.');
      setIsSubmitting(false);
    }
  };

  const isFormValid = sourceName.trim() && (
    (inputMode === 'paste' && rawContent.trim()) ||
    (inputMode === 'upload' && selectedFile)
  );

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

          {/* ===== Source Type Selection ===== */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Source Type</label>
            <div className="grid grid-cols-5 gap-2">
              {SOURCE_TYPES.map((sourceType) => (
                <button
                  key={sourceType.value}
                  onClick={() => {
                    setSelectedType(sourceType.value);
                    setSourceFormat('raw');
                  }}
                  className={`p-2.5 rounded-xl border-2 text-center transition-all ${
                    selectedType === sourceType.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <sourceType.icon className={`w-5 h-5 mx-auto mb-1 ${
                    selectedType === sourceType.value ? 'text-primary-600' : 'text-neutral-400'
                  }`} />
                  <p className={`text-xs font-medium ${
                    selectedType === sourceType.value ? 'text-primary-700' : 'text-neutral-700'
                  }`}>{sourceType.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* ===== Transcript Format (meeting only) ===== */}
          {showFormatPicker && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Transcript Format</label>
              <div className="flex gap-2">
                {TRANSCRIPT_FORMATS.map((format) => (
                  <button
                    key={format.value}
                    onClick={() => setSourceFormat(format.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      sourceFormat === format.value
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                    }`}
                  >
                    {format.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ===== Source Name ===== */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder={
                selectedType === 'meeting' ? 'e.g., Sprint Planning - Jan 15' :
                selectedType === 'email' ? 'e.g., Client Feedback Thread' :
                selectedType === 'slack' ? 'e.g., #product-decisions Jan 10' :
                'e.g., Updated Requirements Doc'
              }
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:border-primary-500
                         focus:ring-2 focus:ring-primary-200 outline-none text-sm"
            />
          </div>

          {/* ===== Meeting-specific metadata ===== */}
          {showMeetingMetadata && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
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
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Meeting Type</label>
                  <select
                    value={meetingType}
                    onChange={(e) => setMeetingType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:border-primary-500
                               focus:ring-2 focus:ring-primary-200 outline-none text-sm"
                  >
                    {MEETING_TYPES.map((mt) => (
                      <option key={mt.value} value={mt.value}>{mt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Attendees</label>
                <input
                  type="text"
                  value={attendees}
                  onChange={(e) => setAttendees(e.target.value)}
                  placeholder="e.g., John, Sarah, Mike (leave blank for auto-detection from transcript)"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:border-primary-500
                             focus:ring-2 focus:ring-primary-200 outline-none text-sm"
                />
                <p className="text-xs text-neutral-400 mt-0.5">
                  If left blank, participants will be auto-detected from Otter/Fireflies/Slack transcripts.
                </p>
              </div>
            </div>
          )}

          {/* ===== Input Mode Toggle (Paste vs Upload) ===== */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-neutral-700">
                Content <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-1 bg-neutral-100 rounded-lg p-0.5">
                <button
                  onClick={() => setInputMode('paste')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    inputMode === 'paste'
                      ? 'bg-white text-neutral-900 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  <PencilIcon className="w-3 h-3" />
                  Paste
                </button>
                <button
                  onClick={() => setInputMode('upload')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    inputMode === 'upload'
                      ? 'bg-white text-neutral-900 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  <ArrowUpTrayIcon className="w-3 h-3" />
                  Upload File
                </button>
              </div>
            </div>

            {/* Paste Mode */}
            {inputMode === 'paste' && (
              <>
                <textarea
                  value={rawContent}
                  onChange={(e) => setRawContent(e.target.value)}
                  placeholder={getPlaceholder()}
                  rows={10}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:border-primary-500
                             focus:ring-2 focus:ring-primary-200 outline-none text-sm resize-y font-mono"
                />
                <p className="text-xs text-neutral-400 mt-1">
                  AI will analyze this content and suggest scope changes for your review.
                </p>
              </>
            )}

            {/* Upload Mode */}
            {inputMode === 'upload' && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  selectedFile
                    ? 'border-primary-300 bg-primary-50'
                    : 'border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.json,.csv,.html,.text,.log,.pdf,.docx,.doc"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {selectedFile ? (
                  <div>
                    <DocumentArrowUpIcon className="w-8 h-8 mx-auto text-primary-500 mb-2" />
                    <p className="text-sm font-medium text-primary-700">{selectedFile.name}</p>
                    <p className="text-xs text-primary-500 mt-0.5">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="mt-2 text-xs text-red-600 hover:underline"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div>
                    <ArrowUpTrayIcon className="w-8 h-8 mx-auto text-neutral-400 mb-2" />
                    <p className="text-sm text-neutral-600">Click to select a file</p>
                    <p className="text-xs text-neutral-400 mt-1">
                      Supported: .pdf, .docx, .doc, .txt, .md, .json, .csv, .html
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error */}
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
            disabled={isSubmitting || !isFormValid}
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
