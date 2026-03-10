'use client';

import { useMemo } from 'react';
import MermaidDiagram from './MermaidDiagram';

interface DocumentPreviewProps {
  title: string;
  content: unknown[];
  projectName?: string;
  teamMembers?: { name: string; role: string }[];
  className?: string;
}

/**
 * Live document preview that renders BlockNote JSON as beautiful HTML
 * with support for Mermaid diagrams, tables, code blocks, and more.
 */
export default function DocumentPreview({
  title,
  content,
  projectName,
  teamMembers,
  className,
}: DocumentPreviewProps) {
  const blocks = useMemo(() => (Array.isArray(content) ? content : []), [content]);

  const dateStr = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      className={`bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 overflow-y-auto ${className || ''}`}
    >
      <div className="max-w-[800px] mx-auto px-8 py-10">
        {/* Document Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 mb-2">
            {title || 'Untitled Document'}
          </h1>
          {projectName && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Project: {projectName}
            </p>
          )}
          {teamMembers && teamMembers.length > 0 && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
              <span className="font-medium text-neutral-600 dark:text-neutral-300">Team:</span>{' '}
              {teamMembers.map((m) => `${m.name} (${m.role})`).join(', ')}
            </p>
          )}
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{dateStr}</p>
        </div>
        <hr className="border-neutral-200 dark:border-neutral-800 mb-8" />

        {/* Content Blocks */}
        {blocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-neutral-400 dark:text-neutral-500">
            <svg
              className="w-12 h-12 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
            <p className="text-sm">Use the AI chat to generate content</p>
            <p className="text-xs mt-1">
              Your document preview will appear here
            </p>
          </div>
        ) : (
          <div className="preview-content space-y-1">
            {blocks.map((block: any, idx: number) => (
              <PreviewBlock key={idx} block={block} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Individual Block Renderer ───────────────────────────────

function PreviewBlock({ block }: { block: any }) {
  if (!block || typeof block !== 'object') return null;

  const type = block.type || 'paragraph';
  const props = block.props || {};
  const content = block.content || [];

  switch (type) {
    case 'mermaid':
      return (
        <div className="my-4">
          <MermaidDiagram
            code={props.code || ''}
            caption={props.caption}
          />
        </div>
      );

    case 'heading': {
      const level = props.level || 1;
      const Tag = `h${Math.min(Math.max(level, 1), 3)}` as keyof JSX.IntrinsicElements;
      const styles: Record<number, string> = {
        1: 'text-xl font-bold mt-8 mb-3 text-neutral-900 dark:text-neutral-50',
        2: 'text-lg font-semibold mt-6 mb-2 text-neutral-800 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-800 pb-1.5',
        3: 'text-base font-semibold mt-5 mb-2 text-neutral-700 dark:text-neutral-200',
      };
      return (
        <Tag className={styles[level] || styles[1]}>
          <InlineContent content={content} />
        </Tag>
      );
    }

    case 'paragraph': {
      const text = extractText(content);
      if (!text.trim()) return <div className="h-2" />;
      return (
        <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 my-1.5">
          <InlineContent content={content} />
        </p>
      );
    }

    case 'bulletListItem':
      return (
        <div className="flex gap-2 pl-4 my-0.5">
          <span className="text-brand-dark dark:text-[#E4FF1A] mt-0.5 text-sm">&#8226;</span>
          <span className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
            <InlineContent content={content} />
          </span>
        </div>
      );

    case 'numberedListItem':
      return (
        <div className="flex gap-2 pl-4 my-0.5">
          <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400 min-w-[18px]">
            {(props.index || 1)}.
          </span>
          <span className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
            <InlineContent content={content} />
          </span>
        </div>
      );

    case 'checkListItem':
      return (
        <div className="flex items-center gap-2 pl-4 my-0.5">
          <input
            type="checkbox"
            checked={!!props.checked}
            readOnly
            className="w-3.5 h-3.5 rounded border-neutral-300 dark:border-neutral-600 accent-brand-lime"
          />
          <span
            className={`text-sm leading-relaxed ${
              props.checked
                ? 'line-through text-neutral-400 dark:text-neutral-500'
                : 'text-neutral-700 dark:text-neutral-300'
            }`}
          >
            <InlineContent content={content} />
          </span>
        </div>
      );

    case 'codeBlock': {
      const lang = props.language || '';
      return (
        <div className="my-3 rounded-lg overflow-hidden">
          {lang && (
            <div className="bg-neutral-700 dark:bg-neutral-800 px-3 py-1 text-[11px] text-neutral-300 font-mono">
              {lang}
            </div>
          )}
          <pre className="bg-neutral-800 dark:bg-neutral-900 text-neutral-100 p-4 text-xs font-mono overflow-x-auto leading-relaxed">
            <code>{extractText(content)}</code>
          </pre>
        </div>
      );
    }

    case 'quote':
    case 'callout':
      return (
        <blockquote className="border-l-3 border-[#E4FF1A] bg-neutral-50 dark:bg-neutral-900 rounded-r-lg px-4 py-3 my-3 text-sm text-neutral-600 dark:text-neutral-400 italic">
          <InlineContent content={content} />
        </blockquote>
      );

    case 'divider':
    case 'pageBreak':
      return <hr className="border-neutral-200 dark:border-neutral-800 my-6" />;

    case 'image':
      return (
        <figure className="my-4 text-center">
          {props.url && (
            <img
              src={props.url}
              alt={props.caption || ''}
              className="max-w-full rounded-lg border border-neutral-200 dark:border-neutral-700 mx-auto"
            />
          )}
          {props.caption && (
            <figcaption className="text-xs text-neutral-500 mt-2 italic">
              {props.caption}
            </figcaption>
          )}
        </figure>
      );

    case 'table':
      return <TableBlock block={block} />;

    default: {
      const text = extractText(content);
      if (!text.trim()) return null;
      return (
        <p className="text-sm text-neutral-700 dark:text-neutral-300 my-1.5">
          <InlineContent content={content} />
        </p>
      );
    }
  }
}

// ── Inline Content Renderer ─────────────────────────────────

function InlineContent({ content }: { content: any[] }) {
  if (!content || !Array.isArray(content)) return null;

  return (
    <>
      {content.map((item, idx) => {
        if (typeof item === 'string') return <span key={idx}>{item}</span>;
        if (!item || typeof item !== 'object') return null;

        let text: React.ReactNode = item.text || '';
        const styles = item.styles || {};

        if (styles.bold) text = <strong className="font-semibold text-neutral-900 dark:text-neutral-100">{text}</strong>;
        if (styles.italic) text = <em>{text}</em>;
        if (styles.underline) text = <u>{text}</u>;
        if (styles.strikethrough) text = <s className="text-neutral-400">{text}</s>;
        if (styles.code) {
          text = (
            <code className="bg-neutral-100 dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 px-1 py-0.5 rounded text-[12px] font-mono">
              {text}
            </code>
          );
        }
        if (item.href) {
          text = (
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {text}
            </a>
          );
        }

        return <span key={idx}>{text}</span>;
      })}
    </>
  );
}

// ── Table Block ─────────────────────────────────────────────

/**
 * Extract text content from a table cell regardless of format.
 * BlockNote tables can store cells in various formats:
 * - Array of inline content: [{type: "text", text: "...", styles: {}}]
 * - Single inline object: {type: "text", text: "...", styles: {}}
 * - Object with content array: {content: [{type: "text", text: "..."}]}
 * - Nested array (BlockNote v0.47): [[{type: "text", text: "..."}]]
 * - Plain string
 */
function extractCellContent(cell: any): any[] {
  if (!cell) return [{ type: 'text', text: '', styles: {} }];

  // Already an array of inline content objects
  if (Array.isArray(cell)) {
    // Check if it's a nested array like [[{type: "text", ...}]]
    if (cell.length > 0 && Array.isArray(cell[0])) {
      return extractCellContent(cell[0]);
    }
    // Check if items look like inline content
    if (cell.length > 0 && typeof cell[0] === 'object' && ('text' in cell[0] || 'type' in cell[0])) {
      return cell;
    }
    // Array of strings or unknown
    return [{ type: 'text', text: cell.map(String).join(''), styles: {} }];
  }

  // Object with content property (BlockNote cell wrapper)
  if (typeof cell === 'object' && cell.content) {
    return extractCellContent(cell.content);
  }

  // Single inline content object: {type: "text", text: "..."}
  if (typeof cell === 'object' && ('text' in cell)) {
    return [cell];
  }

  // Plain string
  if (typeof cell === 'string') {
    return [{ type: 'text', text: cell, styles: {} }];
  }

  // Fallback
  return [{ type: 'text', text: String(cell ?? ''), styles: {} }];
}

function TableBlock({ block }: { block: any }) {
  const rows = block?.content?.rows || block?.content || [];
  if (!Array.isArray(rows) || rows.length === 0) return null;

  return (
    <div className="my-4 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row: any, i: number) => (
            <tr
              key={i}
              className={
                i === 0
                  ? 'bg-neutral-50 dark:bg-neutral-800'
                  : 'border-t border-neutral-100 dark:border-neutral-800'
              }
            >
              {(row.cells || []).map((cell: any, j: number) => {
                const Tag = i === 0 ? 'th' : 'td';
                const inlineContent = extractCellContent(cell);
                return (
                  <Tag
                    key={j}
                    className={`px-3 py-2 text-left ${
                      i === 0
                        ? 'font-semibold text-neutral-700 dark:text-neutral-200'
                        : 'text-neutral-600 dark:text-neutral-300'
                    }`}
                  >
                    <InlineContent content={inlineContent} />
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

// ── Utility ─────────────────────────────────────────────────

function extractText(content: any[]): string {
  if (!content || !Array.isArray(content)) return '';
  return content
    .map((item) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item?.text) return item.text;
      return '';
    })
    .join('');
}
