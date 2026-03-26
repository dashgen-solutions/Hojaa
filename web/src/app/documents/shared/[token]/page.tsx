'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSharedDocument, submitDocumentApproval, type SharedDocumentView, type PricingLineItemInfo } from '@/lib/api';
import dynamic from 'next/dynamic';

const MermaidDiagram = dynamic(() => import('@/components/documents/MermaidDiagram'), { ssr: false });

/**
 * Extract text from a table cell in any format (array, object, string, nested).
 */
function extractCellText(cell: any): string {
  if (!cell) return '';
  if (typeof cell === 'string') return cell;
  if (Array.isArray(cell)) {
    if (cell.length > 0 && Array.isArray(cell[0])) return extractCellText(cell[0]);
    return cell.map((item: any) => (typeof item === 'object' ? item?.text ?? '' : String(item))).join('');
  }
  if (typeof cell === 'object') {
    if ('content' in cell) return extractCellText(cell.content);
    return cell?.text ?? '';
  }
  return String(cell);
}

/**
 * Render a single BlockNote content block.
 */
function renderBlock(block: any, idx: number): JSX.Element | null {
  const blockType = block?.type ?? 'paragraph';
  const props = block?.props ?? {};

  let text = '';
  const inlineContent = block?.content;
  if (Array.isArray(inlineContent)) {
    text = inlineContent
      .map((c: any) => (typeof c === 'string' ? c : c?.text ?? ''))
      .join('');
  }

  const children = Array.isArray(block?.children)
    ? block.children.map((child: any, ci: number) => renderBlock(child, ci))
    : null;

  switch (blockType) {
    case 'heading': {
      const level = props.level || 1;
      const Tag = (`h${Math.min(level, 4)}` as keyof JSX.IntrinsicElements);
      const sizeClass =
        level === 1
          ? 'text-2xl font-bold mt-6 mb-3'
          : level === 2
          ? 'text-xl font-semibold mt-5 mb-2'
          : 'text-lg font-medium mt-4 mb-2';
      return (
        <Tag key={idx} className={`${sizeClass} text-neutral-900 dark:text-neutral-100`}>
          {text}
          {children}
        </Tag>
      );
    }
    case 'bulletListItem':
      return (
        <li key={idx} className="list-disc ml-6 text-neutral-700 dark:text-neutral-300 mb-1">
          {text}
          {children && <ul>{children}</ul>}
        </li>
      );
    case 'numberedListItem':
      return (
        <li key={idx} className="list-decimal ml-6 text-neutral-700 dark:text-neutral-300 mb-1">
          {text}
          {children && <ol>{children}</ol>}
        </li>
      );
    case 'codeBlock':
      return (
        <pre
          key={idx}
          className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4 text-sm font-mono overflow-x-auto my-3 whitespace-pre-wrap"
        >
          {text || props.code || ''}
        </pre>
      );
    case 'mermaid': {
      const diagramCode = props.code || text || '';
      const widthPct = props.width ? `${props.width}%` : '100%';
      return (
        <div key={idx} style={{ maxWidth: widthPct, margin: '0 auto' }}>
          <MermaidDiagram code={diagramCode} />
        </div>
      );
    }
    case 'table': {
      const rows = block?.content?.rows || (Array.isArray(block?.content) ? block.content : []);
      if (!Array.isArray(rows) || rows.length === 0) return null;
      return (
        <div key={idx} className="my-4 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
          <table className="w-full text-sm border-collapse">
            <tbody>
              {rows.map((row: any, ri: number) => (
                <tr
                  key={ri}
                  className={ri === 0 ? 'bg-neutral-50 dark:bg-neutral-800' : 'border-t border-neutral-100 dark:border-neutral-800'}
                >
                  {(row.cells || []).map((cell: any, ci: number) => {
                    const Tag = ri === 0 ? 'th' : 'td';
                    const cellText = extractCellText(cell);
                    return (
                      <Tag key={ci} className={`px-3 py-2 text-left ${ri === 0 ? 'font-semibold text-neutral-700 dark:text-neutral-200' : 'text-neutral-600 dark:text-neutral-300'}`}>
                        {cellText}
                      </Tag>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    default:
      if (!text && !children) return null;
      return (
        <p key={idx} className="text-neutral-700 dark:text-neutral-300 mb-2 leading-relaxed">
          {text}
          {children}
        </p>
      );
  }
}

function PricingTable({ items }: { items: PricingLineItemInfo[] }) {
  const grandTotal = items.reduce((sum, i) => sum + (i.line_total || 0), 0);

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Pricing</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-neutral-300 dark:border-neutral-600">
              <th className="text-left py-2 px-3 font-semibold text-neutral-700 dark:text-neutral-300">Item</th>
              <th className="text-right py-2 px-3 font-semibold text-neutral-700 dark:text-neutral-300">Qty</th>
              <th className="text-right py-2 px-3 font-semibold text-neutral-700 dark:text-neutral-300">Unit Price</th>
              <th className="text-right py-2 px-3 font-semibold text-neutral-700 dark:text-neutral-300">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-neutral-200 dark:border-neutral-700">
                <td className="py-2 px-3 text-neutral-700 dark:text-neutral-300">{item.name}</td>
                <td className="py-2 px-3 text-right text-neutral-600 dark:text-neutral-400">{item.quantity}</td>
                <td className="py-2 px-3 text-right text-neutral-600 dark:text-neutral-400">
                  ${item.unit_price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2 px-3 text-right font-medium text-neutral-800 dark:text-neutral-200">
                  ${item.line_total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-neutral-400 dark:border-neutral-500">
              <td colSpan={3} className="py-2 px-3 text-right font-bold text-neutral-900 dark:text-neutral-100">
                Total
              </td>
              <td className="py-2 px-3 text-right font-bold text-neutral-900 dark:text-neutral-100">
                ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function ApprovalPanel({
  token,
  initialApproval,
}: {
  token: string;
  initialApproval: SharedDocumentView['my_approval'];
}) {
  const [decision, setDecision] = useState<string | null>(initialApproval?.decision ?? null);
  const [reason, setReason] = useState(initialApproval?.reason ?? '');
  const [decidedAt, setDecidedAt] = useState<string | null>(initialApproval?.decided_at ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [showReasonInput, setShowReasonInput] = useState<'approved' | 'rejected' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (d: 'approved' | 'rejected') => {
    setSubmitting(true);
    setError(null);
    try {
      await submitDocumentApproval(token, d, reason.trim() || undefined);
      setDecision(d);
      setDecidedAt(new Date().toISOString());
      setShowReasonInput(null);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Already decided — show confirmation
  if (decision && decision !== 'pending') {
    const isApproved = decision === 'approved';
    return (
      <div className={`rounded-2xl overflow-hidden shadow-sm ${isApproved ? 'bg-white dark:bg-neutral-900' : 'bg-white dark:bg-neutral-900'}`}>
        {/* Status strip */}
        <div className={`h-1.5 ${isApproved ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-red-400 to-rose-500'}`} />
        <div className="p-6">
          <div className="flex items-center gap-4">
            <div className={`flex items-center justify-center w-12 h-12 rounded-full ${isApproved ? 'bg-green-100 dark:bg-green-900/40' : 'bg-red-100 dark:bg-red-900/40'}`}>
              <svg className={`w-6 h-6 ${isApproved ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                {isApproved
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                }
              </svg>
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${isApproved ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                Document {isApproved ? 'Approved' : 'Rejected'}
              </h3>
              {decidedAt && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {new Date(decidedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
          {reason && (
            <div className={`mt-4 ml-16 rounded-lg px-4 py-3 text-sm ${isApproved ? 'bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-200' : 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200'}`}>
              <p className="font-medium text-xs uppercase tracking-wide opacity-70 mb-1">Your comment</p>
              <p>{reason}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Pending — show decision form
  return (
    <div className="rounded-2xl overflow-hidden bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200 dark:border-neutral-800">
      {/* Header strip */}
      <div className="h-1.5 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Your approval is requested
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Review the document and submit your decision
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            {error}
          </div>
        )}

        {showReasonInput ? (
          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                {showReasonInput === 'rejected' ? 'Reason for rejection' : 'Comment (optional)'}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={showReasonInput === 'rejected' ? 'Please explain why you are rejecting this document...' : 'Add any comments or feedback...'}
                className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-4 py-3 text-sm text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-neutral-900 dark:focus:ring-neutral-100 resize-none transition-shadow"
                rows={3}
                autoFocus
              />
              {showReasonInput === 'rejected' && !reason.trim() && (
                <p className="mt-1.5 text-xs text-neutral-400">A reason is required when rejecting.</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleSubmit(showReasonInput)}
                disabled={submitting || (showReasonInput === 'rejected' && !reason.trim())}
                className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  showReasonInput === 'approved'
                    ? 'bg-green-600 hover:bg-green-700 hover:shadow-md active:scale-[0.98]'
                    : 'bg-red-600 hover:bg-red-700 hover:shadow-md active:scale-[0.98]'
                }`}
              >
                {submitting ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : showReasonInput === 'approved' ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                )}
                {submitting ? 'Submitting...' : showReasonInput === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'}
              </button>
              <button
                onClick={() => { setShowReasonInput(null); setReason(''); setError(null); }}
                disabled={submitting}
                className="rounded-xl px-5 py-3 text-sm font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowReasonInput('approved')}
              className="group relative inline-flex items-center justify-center gap-2.5 rounded-xl bg-green-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 hover:shadow-md active:scale-[0.98] transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Approve
            </button>
            <button
              onClick={() => setShowReasonInput('rejected')}
              className="group relative inline-flex items-center justify-center gap-2.5 rounded-xl bg-white dark:bg-neutral-800 border-2 border-red-200 dark:border-red-800 px-5 py-3.5 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 hover:border-red-300 dark:hover:border-red-700 active:scale-[0.98] transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SharedDocumentPage() {
  const params = useParams();
  const token = params?.token as string;

  const [doc, setDoc] = useState<SharedDocumentView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getSharedDocument(token)
      .then(setDoc)
      .catch((err) => {
        console.error('Failed to load shared document:', err);
        const msg =
          err?.response?.status === 404
            ? 'This link is invalid or has expired.'
            : err?.response?.status === 410
            ? 'This document link has expired.'
            : 'Something went wrong loading this document.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-neutral-300 border-t-neutral-800 rounded-full mx-auto mb-4" />
          <p className="text-neutral-500 text-sm">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
        <div className="text-center max-w-md px-4">
          <div className="text-4xl mb-4">📄</div>
          <h1 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
            Document Not Found
          </h1>
          <p className="text-neutral-500 text-sm">{error || 'This link may be invalid.'}</p>
        </div>
      </div>
    );
  }

  const blocks = Array.isArray(doc.content) ? doc.content : [];
  const isApprover = doc.recipient?.role === 'approver';

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <header className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {doc.title || 'Untitled Document'}
              </h1>
              <p className="text-sm text-neutral-500 mt-0.5">
                Shared by {doc.creator_name}
                {doc.sent_at && (
                  <> &middot; {new Date(doc.sent_at).toLocaleDateString()}</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isApprover && (
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  Approver
                </span>
              )}
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
              </span>
            </div>
          </div>
          {doc.recipient?.name && (
            <p className="text-xs text-neutral-400 mt-1">
              Viewing as: {doc.recipient.name} ({doc.recipient.email})
            </p>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm p-8">
          {blocks.map((block: any, idx: number) => renderBlock(block, idx))}
          {blocks.length === 0 && (
            <p className="text-center text-neutral-400 py-12">
              This document has no content yet.
            </p>
          )}
        </div>

        {/* Pricing Table */}
        {doc.pricing_items && doc.pricing_items.length > 0 && (
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm p-8 mt-6">
            <PricingTable items={doc.pricing_items} />
          </div>
        )}

        {/* Approval Panel — only shown to approver recipients */}
        {isApprover && (
          <div className="mt-6">
            <ApprovalPanel token={token} initialApproval={doc.my_approval} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-neutral-400">
        Powered by Hojaa
      </footer>
    </div>
  );
}
