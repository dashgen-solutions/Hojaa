'use client';

import { useEffect, useRef, useState, useId } from 'react';

interface MermaidDiagramProps {
  code: string;
  caption?: string;
  className?: string;
}

export default function MermaidDiagram({ code, caption, className }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const uniqueId = useId().replace(/:/g, '_');

  useEffect(() => {
    if (!code.trim()) return;

    let cancelled = false;

    const renderDiagram = async () => {
      try {
        // Dynamic import to avoid SSR issues
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'neutral',
          securityLevel: 'loose',
          fontFamily: 'Inter, system-ui, sans-serif',
          flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
          sequence: { useMaxWidth: true },
          gantt: { useMaxWidth: true },
        });

        const { svg: renderedSvg } = await mermaid.render(
          `mermaid_${uniqueId}`,
          code.trim(),
        );

        if (!cancelled) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Failed to render diagram');
          setSvg('');
        }
      }
    };

    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [code, uniqueId]);

  if (error) {
    return (
      <div
        className={`rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-4 ${className || ''}`}
      >
        <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-2">
          Diagram rendering error
        </p>
        <pre className="text-xs text-red-500 dark:text-red-400 whitespace-pre-wrap overflow-x-auto">
          {code}
        </pre>
        <p className="text-[11px] text-red-400 mt-2">{error}</p>
      </div>
    );
  }

  if (!svg) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 p-8 ${className || ''}`}
      >
        <div className="flex items-center gap-2 text-neutral-400">
          <div className="w-4 h-4 border-2 border-neutral-300 dark:border-neutral-600 border-t-neutral-600 dark:border-t-neutral-300 rounded-full animate-spin" />
          <span className="text-xs">Rendering diagram...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden ${className || ''}`}
    >
      <div
        ref={containerRef}
        className="p-5 flex items-center justify-center overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {caption && (
        <div className="border-t border-neutral-100 dark:border-neutral-800 px-4 py-2 bg-neutral-50 dark:bg-neutral-950">
          <p className="text-xs text-neutral-500 text-center italic">{caption}</p>
        </div>
      )}
    </div>
  );
}
