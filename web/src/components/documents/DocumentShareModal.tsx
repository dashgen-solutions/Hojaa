'use client';

import { useState, useEffect } from 'react';
import {
  XMarkIcon,
  LinkIcon,
  ClipboardDocumentIcon,
  PaperAirplaneIcon,
  PlusIcon,
  TrashIcon,
  EnvelopeIcon,
  UserIcon,
  CheckCircleIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import type { DocumentRecipientInfo } from '@/lib/api';
import {
  shareDocument,
  getDocumentRecipients,
  sendDocument,
} from '@/lib/api';

interface DocumentShareModalProps {
  documentId: string;
  shareToken: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_DOT: Record<string, { color: string; label: string }> = {
  sent: { color: 'bg-blue-500', label: 'Sent' },
  viewed: { color: 'bg-yellow-500', label: 'Viewed' },
  completed: { color: 'bg-green-500', label: 'Completed' },
  pending: { color: 'bg-neutral-400', label: 'Pending' },
};

function getRecipientStatus(r: DocumentRecipientInfo): string {
  if (r.completed_at) return 'completed';
  if (r.viewed_at) return 'viewed';
  if (r.sent_at) return 'sent';
  return 'pending';
}

export default function DocumentShareModal({
  documentId,
  shareToken,
  isOpen,
  onClose,
}: DocumentShareModalProps) {
  const [token, setToken] = useState(shareToken);
  const [recipients, setRecipients] = useState<DocumentRecipientInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // New recipient form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'viewer' | 'approver'>('viewer');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    getDocumentRecipients(documentId)
      .then(setRecipients)
      .catch((err) => console.error('Failed to fetch recipients:', err))
      .finally(() => setLoading(false));
  }, [isOpen, documentId]);

  const shareUrl = token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/documents/shared/${token}`
    : null;

  const handleGenerateLink = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await shareDocument(documentId);
      setToken(result.share_token);
      if (result.recipients) {
        setRecipients(result.recipients);
      }
    } catch (err) {
      console.error('Failed to generate share link:', err);
      setError('Failed to generate share link.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleAddRecipient = async () => {
    if (!newName.trim() || !newEmail.trim()) return;

    setAdding(true);
    setError(null);
    try {
      const result = await shareDocument(documentId, [
        { name: newName.trim(), email: newEmail.trim(), role: newRole },
      ]);
      setToken(result.share_token);
      setRecipients(result.recipients);
      setNewName('');
      setNewEmail('');
      setNewRole('viewer');
    } catch (err) {
      console.error('Failed to add recipient:', err);
      setError('Failed to add recipient.');
    } finally {
      setAdding(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    setError(null);
    try {
      await sendDocument(documentId);
      // Refresh recipients to get updated sent_at timestamps
      const updated = await getDocumentRecipients(documentId);
      setRecipients(updated);
    } catch (err) {
      console.error('Failed to send document:', err);
      setError('Failed to send document.');
    } finally {
      setSending(false);
    }
  };

  // When used inline (in side panel), render without modal wrapper
  const content = (
    <div className="flex flex-col gap-5">
      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Share Link Section */}
      <div>
        <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Share Link</h4>
        {shareUrl ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-3 py-2 text-xs text-neutral-700 dark:text-neutral-300 truncate">
              {shareUrl}
            </div>
            <button
              onClick={handleCopyLink}
              className="flex-shrink-0 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              title="Copy link"
            >
              {copied ? (
                <CheckCircleIcon className="h-4 w-4 text-green-600" />
              ) : (
                <ClipboardDocumentIcon className="h-4 w-4 text-neutral-500" />
              )}
            </button>
          </div>
        ) : (
          <button
            onClick={handleGenerateLink}
            disabled={generating}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            <LinkIcon className="h-4 w-4" />
            {generating ? 'Generating...' : 'Generate Link'}
          </button>
        )}
      </div>

      {/* Add Recipient */}
      <div>
        <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Add Recipient</h4>
        <div className="space-y-2">
          <div className="relative">
            <UserIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 py-1.5 pl-8 pr-3 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
            />
          </div>
          <div className="relative">
            <EnvelopeIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
            <input
              type="email"
              placeholder="Email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 py-1.5 pl-8 pr-3 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as 'viewer' | 'approver')}
              className="flex-1 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 py-1.5 px-2.5 text-sm text-neutral-700 dark:text-neutral-300 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
            >
              <option value="viewer">Viewer</option>
              <option value="approver">Approver</option>
            </select>
            <button
              onClick={handleAddRecipient}
              disabled={adding || !newName.trim() || !newEmail.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      </div>

      {/* Recipients List */}
      <div>
        <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          Recipients ({recipients.length})
        </h4>

        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="animate-pulse h-12 bg-neutral-100 dark:bg-neutral-800 rounded-md" />
            ))}
          </div>
        )}

        {!loading && recipients.length === 0 && (
          <p className="text-sm text-neutral-500 py-4 text-center">
            No recipients added yet.
          </p>
        )}

        {!loading && recipients.length > 0 && (
          <div className="space-y-2">
            {recipients.map((r) => {
              const status = getRecipientStatus(r);
              const dot = STATUS_DOT[status] || STATUS_DOT.pending;

              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                        {r.name}
                      </p>
                      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 capitalize">
                        {r.role}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 truncate">{r.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`h-2 w-2 rounded-full ${dot.color}`} />
                    <span className="text-xs text-neutral-500">{dot.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Send Button */}
      {recipients.length > 0 && (
        <button
          onClick={handleSend}
          disabled={sending}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition-colors disabled:opacity-50"
        >
          <PaperAirplaneIcon className="h-4 w-4" />
          {sending ? 'Sending...' : 'Send Document'}
        </button>
      )}
    </div>
  );

  // If isOpen is used as modal mode (not embedded in side panel)
  // Check if we're being used standalone vs inside a panel
  // The DocumentEditor embeds this directly when panel is open, so we detect modal mode
  // by checking if onClose would make sense as a modal dismiss
  if (!isOpen) return null;

  // When embedded in a side panel, just render content directly
  // The parent (DocumentEditor) handles the panel container
  return content;
}
