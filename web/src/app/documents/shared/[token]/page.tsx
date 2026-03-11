'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSharedDocument, type SharedDocumentView, type PricingLineItemInfo } from '@/lib/api';

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
 * Render a single BlockNote content block as HTML.
 */
function renderBlock(block: any, idx: number): JSX.Element | null {
  const blockType = block?.type ?? 'paragraph';
  const props = block?.props ?? {};

  // Extract text from inline content
  let text = '';
  const inlineContent = block?.content;
  if (Array.isArray(inlineContent)) {
    text = inlineContent
      .map((c: any) => (typeof c === 'string' ? c : c?.text ?? ''))
      .join('');
  }

  // Render children recursively
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
    case 'mermaid':
      return (
        <pre
          key={idx}
          className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-xs font-mono my-3 whitespace-pre-wrap"
        >
          {props.code || text || '[Mermaid Diagram]'}
        </pre>
      );
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
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
            </span>
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
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-neutral-400">
        Powered by Hojaa
      </footer>
    </div>
  );
}
