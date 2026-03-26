'use client';

/**
 * Custom BlockNote block spec for rendering Mermaid diagrams inside the editor.
 *
 * The backend stores mermaid diagrams as:
 *   { type: "mermaid", props: { code: "graph TD\n  A-->B" }, content: [] }
 *
 * Without this block spec BlockNote would silently ignore them.
 */

import { createReactBlockSpec } from '@blocknote/react';
import { defaultProps } from '@blocknote/core';
import MermaidDiagram from './MermaidDiagram';
import { useState } from 'react';

export const MermaidBlockSpec = createReactBlockSpec(
  {
    type: 'mermaid' as const,
    propSchema: {
      code: { default: '' },
      width: { default: 100 },
    },
    content: 'none',
  },
  {
    render: (props) => {
      const code = props.block.props.code || '';
      const width = props.block.props.width ?? 100;
      const [editing, setEditing] = useState(false);

      const handleResize = (newWidth: number) => {
        const clamped = Math.max(25, Math.min(100, newWidth));
        props.editor.updateBlock(props.block, {
          props: { width: clamped },
        } as any);
      };

      if (editing) {
        return (
          <div className="my-3 rounded-lg border border-blue-300 dark:border-blue-700 overflow-hidden">
            <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300">
              <span>Mermaid Diagram</span>
              <button
                onClick={() => setEditing(false)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-xs underline"
              >
                Preview
              </button>
            </div>
            <textarea
              className="w-full bg-neutral-900 text-neutral-100 font-mono text-xs p-3 min-h-[120px] resize-y focus:outline-none"
              defaultValue={code}
              onBlur={(e) => {
                props.editor.updateBlock(props.block, {
                  props: { code: e.target.value },
                } as any);
                setEditing(false);
              }}
              autoFocus
            />
          </div>
        );
      }

      if (!code.trim()) {
        return (
          <div
            className="my-3 p-4 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg text-center text-sm text-neutral-500 cursor-pointer hover:border-blue-400"
            onClick={() => setEditing(true)}
          >
            Click to add a Mermaid diagram
          </div>
        );
      }

      return (
        <div className="my-3 group relative" style={{ maxWidth: `${width}%` }}>
          <div
            className="cursor-pointer"
            onDoubleClick={() => setEditing(true)}
            title="Double-click to edit diagram code"
          >
            <MermaidDiagram code={code} />
          </div>
          {/* Resize controls */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-full px-2 py-0.5 shadow-sm z-10">
            <button
              onClick={() => handleResize(width - 10)}
              className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 px-1 font-bold"
              title="Shrink diagram"
            >−</button>
            <span className="text-[10px] text-neutral-400 min-w-[2.5rem] text-center">{width}%</span>
            <button
              onClick={() => handleResize(width + 10)}
              className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 px-1 font-bold"
              title="Grow diagram"
            >+</button>
          </div>
        </div>
      );
    },
  },
)();
