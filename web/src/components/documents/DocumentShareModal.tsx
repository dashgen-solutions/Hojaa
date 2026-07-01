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
  addDocumentRecipient,
  sendDocument,
  removeDocumentRecipient,
} from '@/lib/api';

interface DocumentShareModalProps {
  documentId: string;
  shareToken: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_DOT: Record<string, { color: string; label: string }> = {
  approved: { color: 'bg-green-500', label: 'Approved' },
  rejected: { color: 'bg-red-500', label: 'Rejected' },
  signed: { color: 'bg-indigo-500', label: 'Signed' },
  sent: { color: 'bg-blue-500', label: 'Sent' },
  viewed: { color: 'bg-yellow-500', label: 'Viewed' },
  completed: { color: 'bg-green-500', label: 'Completed' },
  pending: { color: 'bg-neutral-400', label: 'Pending' },
};

const ROLE_OPTIONS: Array<{
  value: 'viewer' | 'approver' | 'signer';
  label: string;
  description: string;
  badgeClass: string;
}> = [
  {
    value: 'viewer',
    label: 'Viewer',
    description: 'Can read the document',
    badgeClass: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  },
  {
    value: 'approver',
    label: 'Approver',
    description: 'Can approve or reject',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  },
  {
    value: 'signer',
    label: 'Signer',
    description: 'Must sign the document',
    badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
  },
];

const ROLE_ORDER = ['viewer', 'approver', 'signer'] as const;

function getRecipientStatus(r: DocumentRecipientInfo): string {
  if (r.approval?.decision) return r.approval.decision;
  if (r.signature?.signed_at) return 'signed';
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // New recipient form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'viewer' | 'approver' | 'signer'>('viewer');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    getDocumentRecipients(documentId)
      .then((list) => {
        setRecipients(list);
        setSelectedRecipientIds(new Set(list.map((r) => r.id)));
      })
      .catch((err) => console.error('Failed to fetch recipients:', err))
      .finally(() => setLoading(false));
  }, [isOpen, documentId]);

  const toggleRecipientSelection = (recipientId: string) => {
    setSelectedRecipientIds((prev) => {
      const next = new Set(prev);
      if (next.has(recipientId)) {
        next.delete(recipientId);
      } else {
        next.add(recipientId);
      }
      return next;
    });
  };

  const selectAllRecipients = () => {
    setSelectedRecipientIds(new Set(recipients.map((r) => r.id)));
  };

  const deselectAllRecipients = () => {
    setSelectedRecipientIds(new Set());
  };

  const roleCounts = ROLE_ORDER.reduce(
    (acc, role) => {
      acc[role] = recipients.filter((r) => r.role === role).length;
      return acc;
    },
    { viewer: 0, approver: 0, signer: 0 } as Record<(typeof ROLE_ORDER)[number], number>
  );

  const renderRecipientRow = (r: DocumentRecipientInfo) => {
    const status = getRecipientStatus(r);
    const dot = STATUS_DOT[status] || STATUS_DOT.pending;
    const hasApproval = !!r.approval?.decision;
    const hasSignature = !!r.signature?.signed_at;
    const isExpandable = hasApproval || hasSignature;
    const isExpanded = expandedId === r.id;
    const roleMeta = ROLE_OPTIONS.find((opt) => opt.value === r.role);

    return (
      <div key={r.id} className="rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden">
        <div
          className={`flex items-center gap-3 px-3 py-2.5 ${isExpandable ? 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors' : ''}`}
        >
          <input
            type="checkbox"
            checked={selectedRecipientIds.has(r.id)}
            onChange={() => toggleRecipientSelection(r.id)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500 flex-shrink-0"
            title="Include when sending"
          />
          <div
            className={`flex-1 min-w-0 ${isExpandable ? 'cursor-pointer' : ''}`}
            onClick={() => isExpandable && setExpandedId(isExpanded ? null : r.id)}
          >
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                {r.name}
              </p>
              <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium capitalize ${roleMeta?.badgeClass ?? 'bg-neutral-100 text-neutral-600'}`}>
                {r.role}
              </span>
            </div>
            <p className="text-xs text-neutral-500 truncate">{r.email}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${dot.color}`} />
              <span className={`text-xs ${status === 'approved' ? 'text-green-600 dark:text-green-400 font-medium' : status === 'rejected' ? 'text-red-600 dark:text-red-400 font-medium' : status === 'signed' ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-neutral-500'}`}>
                {dot.label}
              </span>
            </div>
            {isExpandable && (
              <svg className={`h-3.5 w-3.5 text-neutral-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); handleRemoveRecipient(r.id); }}
              disabled={removingId === r.id}
              className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-neutral-400 hover:text-red-500 transition-colors disabled:opacity-50"
              title="Remove recipient"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {isExpanded && r.approval && (
          <div className={`px-3 pb-3 border-t ${r.approval.decision === 'approved' ? 'border-green-100 dark:border-green-900/30 bg-green-50/50 dark:bg-green-950/10' : 'border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/10'}`}>
            <div className="pt-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                {r.approval.decision === 'approved' ? (
                  <CheckCircleIcon className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                ) : (
                  <XMarkIcon className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                )}
                <span className={`text-xs font-semibold ${r.approval.decision === 'approved' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                  {r.approval.decision === 'approved' ? 'Approved' : 'Rejected'}
                </span>
                {r.approval.decided_at && (
                  <span className="text-[10px] text-neutral-400 ml-auto">
                    {new Date(r.approval.decided_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              {r.approval.reason ? (
                <div className={`rounded-md px-2.5 py-2 text-xs ${r.approval.decision === 'approved' ? 'bg-green-100/70 text-green-800 dark:bg-green-900/20 dark:text-green-200' : 'bg-red-100/70 text-red-800 dark:bg-red-900/20 dark:text-red-200'}`}>
                  {r.approval.reason}
                </div>
              ) : (
                <p className="text-[11px] text-neutral-400 italic">No reason provided.</p>
              )}
            </div>
          </div>
        )}
        {isExpanded && r.signature?.signed_at && (
          <div className="px-3 pb-3 border-t border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-950/10">
            <div className="pt-2.5 space-y-2">
              <div className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                  Signed by {r.signature.signer_name}
                </span>
                {r.signature.signed_at && (
                  <span className="text-[10px] text-neutral-400 ml-auto">
                    {new Date(r.signature.signed_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-500">
                {r.signature.signature_type === 'draw' ? 'Hand-drawn signature' : 'Typed signature'}
              </p>
              {r.signature.signature_data && (
                <div className="mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-700">
                  <img
                    src={r.signature.signature_data}
                    alt={`Signature of ${r.signature.signer_name}`}
                    className="h-16 max-w-full object-contain bg-white dark:bg-neutral-900 rounded border border-neutral-200 dark:border-neutral-700 p-1.5"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

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
      await addDocumentRecipient(documentId, {
        name: newName.trim(),
        email: newEmail.trim(),
        role: newRole,
      });
      const addedName = newName.trim();
      const addedEmail = newEmail.trim();
      // Refresh list to ensure consistent sorting/state with backend
      const updated = await getDocumentRecipients(documentId);
      setRecipients(updated);
      setSelectedRecipientIds((prev) => {
        const next = new Set(prev);
        const added = updated.find((r) => r.name === addedName && r.email === addedEmail);
        if (added) next.add(added.id);
        return next;
      });
      setNewName('');
      setNewEmail('');
      // Keep selected role so you can add multiple recipients for the same role quickly
    } catch (err: any) {
      console.error('Failed to add recipient:', err);
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to add recipient.');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveRecipient = async (recipientId: string) => {
    setRemovingId(recipientId);
    setError(null);
    try {
      await removeDocumentRecipient(documentId, recipientId);
      setRecipients((prev) => prev.filter((r) => r.id !== recipientId));
      setSelectedRecipientIds((prev) => {
        const next = new Set(prev);
        next.delete(recipientId);
        return next;
      });
    } catch (err) {
      console.error('Failed to remove recipient:', err);
      setError('Failed to remove recipient.');
    } finally {
      setRemovingId(null);
    }
  };

  const handleSend = async () => {
    if (selectedRecipientIds.size === 0) {
      setError('Select at least one recipient to send the document to.');
      return;
    }

    setSending(true);
    setError(null);
    try {
      const res = await sendDocument(documentId, Array.from(selectedRecipientIds));
      if ((res.emails_attempted ?? 0) > 0 && (res.emails_sent ?? 0) === 0) {
        const detail = res.smtp_error_detail?.trim();
        setError(
          detail
            ? `Document marked as sent, but email delivery failed.\n\n${detail}`
            : 'Document marked as sent, but email delivery failed. Please verify SMTP credentials and check server logs.'
        );
      }
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
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-xs text-red-700 whitespace-pre-wrap break-words">
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
        <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">Add Recipient</h4>
        <p className="text-xs text-neutral-500 mb-3">
          Add as many recipients as you need — viewers, approvers, and signers can all be on the same document.
        </p>
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
              onChange={(e) => setNewRole(e.target.value as 'viewer' | 'approver' | 'signer')}
              className="flex-1 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 py-1.5 px-2.5 text-sm text-neutral-700 dark:text-neutral-300 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label} — {role.description}
                </option>
              ))}
            </select>
            <button
              onClick={handleAddRecipient}
              disabled={adding || !newName.trim() || !newEmail.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      </div>

      {/* Recipients List */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Recipients ({recipients.length})
          </h4>
          {recipients.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={selectAllRecipients}
                className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              >
                Select all
              </button>
              <span className="text-neutral-300">|</span>
              <button
                type="button"
                onClick={deselectAllRecipients}
                className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              >
                Clear
              </button>
            </div>
          )}
        </div>
        {recipients.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {ROLE_OPTIONS.map((role) => (
              <span
                key={role.value}
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${role.badgeClass}`}
              >
                {role.label}: {roleCounts[role.value]}
              </span>
            ))}
          </div>
        )}
        {recipients.length > 0 && (
          <p className="text-xs text-neutral-500 mb-2">
            Select who should receive the document email ({selectedRecipientIds.size} selected)
          </p>
        )}

        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="animate-pulse h-12 bg-neutral-100 dark:bg-neutral-800 rounded-md" />
            ))}
          </div>
        )}

        {!loading && recipients.length === 0 && (
          <p className="text-sm text-neutral-500 py-4 text-center">
            No recipients added yet. Add viewers, approvers, and/or signers above.
          </p>
        )}

        {!loading && recipients.length > 0 && (
          <div className="space-y-4">
            {ROLE_ORDER.map((role) => {
              const group = recipients.filter((r) => r.role === role);
              if (group.length === 0) return null;
              const roleMeta = ROLE_OPTIONS.find((r) => r.value === role);
              return (
                <div key={role}>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">
                    {roleMeta?.label}s ({group.length})
                  </p>
                  <div className="space-y-2">
                    {group.map((r) => renderRecipientRow(r))}
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
          disabled={sending || selectedRecipientIds.size === 0}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition-colors disabled:opacity-50"
        >
          <PaperAirplaneIcon className="h-4 w-4" />
          {sending
            ? 'Sending...'
            : selectedRecipientIds.size === 0
            ? 'Select recipients to send'
            : selectedRecipientIds.size === 1
            ? 'Send to 1 recipient'
            : `Send to ${selectedRecipientIds.size} recipients`}
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
