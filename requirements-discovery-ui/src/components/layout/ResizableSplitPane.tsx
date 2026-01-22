"use client";

import { useState, useRef, useEffect, ReactNode } from "react";

interface ResizableSplitPaneProps {
  leftPanel: ReactNode;
  rightPanel: ReactNode;
  defaultLeftWidth?: number; // Percentage (0-100)
  minLeftWidth?: number; // Percentage
  maxLeftWidth?: number; // Percentage
}

export default function ResizableSplitPane({
  leftPanel,
  rightPanel,
  defaultLeftWidth = 50,
  minLeftWidth = 20,
  maxLeftWidth = 80,
}: ResizableSplitPaneProps) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update state if defaultLeftWidth prop changes
  useEffect(() => {
    setLeftWidth(defaultLeftWidth);
  }, [defaultLeftWidth]);

  // Handle mouse movement for resizing
  const handleMouseMove = (event: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const mouseX = event.clientX - containerRect.left;
    
    // Calculate new width as percentage
    let newWidth = (mouseX / containerWidth) * 100;
    
    // Apply min/max constraints
    newWidth = Math.max(minLeftWidth, Math.min(maxLeftWidth, newWidth));
    
    console.log('Resizing to:', newWidth.toFixed(1), '%'); // Debug log
    setLeftWidth(newWidth);
  };

  // Handle mouse up to stop resizing
  const handleMouseUp = () => {
    console.log('Drag ended at:', leftWidth.toFixed(1), '%'); // Debug log
    setIsDragging(false);
  };

  // Add and remove event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging]);

  // Handle double-click to reset to default
  const handleDoubleClick = () => {
    setLeftWidth(defaultLeftWidth);
  };

  // Keyboard shortcuts for quick resizing
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only trigger if Ctrl/Cmd + Alt is pressed
      if ((event.ctrlKey || event.metaKey) && event.altKey) {
        switch (event.key) {
          case "ArrowLeft":
            event.preventDefault();
            setLeftWidth(prev => Math.max(minLeftWidth, prev - 5));
            break;
          case "ArrowRight":
            event.preventDefault();
            setLeftWidth(prev => Math.min(maxLeftWidth, prev + 5));
            break;
          case "0":
            event.preventDefault();
            setLeftWidth(defaultLeftWidth);
            break;
          case "1":
            event.preventDefault();
            setLeftWidth(25);
            break;
          case "2":
            event.preventDefault();
            setLeftWidth(50);
            break;
          case "3":
            event.preventDefault();
            setLeftWidth(75);
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [minLeftWidth, maxLeftWidth, defaultLeftWidth]);

  return (
    <div
      ref={containerRef}
      className="flex w-full h-full overflow-hidden relative"
    >
      {/* Left Panel */}
      <div
        className="overflow-hidden relative"
        style={{ width: `${leftWidth}%` }}
      >
        {leftPanel}
      </div>

      {/* Resizer Handle */}
      <div
        className={`
          relative flex-shrink-0 bg-gray-300 hover:bg-blue-500 transition-all cursor-col-resize group
          ${isDragging ? "bg-blue-600 w-3 shadow-lg" : "w-1.5"}
        `}
        onMouseDown={() => {
          console.log('Starting drag from:', leftWidth.toFixed(1), '%'); // Debug log
          setIsDragging(true);
        }}
        onDoubleClick={handleDoubleClick}
        title="Drag to resize | Double-click to reset"
      >
        {/* Pulsing indicator line */}
        <div className={`
          absolute inset-0 bg-blue-600 transition-opacity
          ${isDragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
        `} />
        
        {/* Grab handle - shows on hover and during drag */}
        <div className={`
          absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
          transition-all duration-200
          ${isDragging ? "opacity-100 scale-110" : "opacity-0 group-hover:opacity-100 scale-100"}
        `}>
          <div className="bg-gradient-to-b from-blue-500 to-blue-600 text-white rounded-lg px-1.5 py-3 shadow-lg border border-blue-400">
            {/* Vertical dots */}
            <div className="flex flex-col gap-1">
              <div className="w-1 h-1 bg-white rounded-full"></div>
              <div className="w-1 h-1 bg-white rounded-full"></div>
              <div className="w-1 h-1 bg-white rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Width indicator - shows during drag */}
        {isDragging && (
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg font-medium">
              {leftWidth.toFixed(0)}% | {(100 - leftWidth).toFixed(0)}%
            </div>
          </div>
        )}

        {/* Hover hint */}
        <div className={`
          absolute -bottom-12 left-1/2 -translate-x-1/2 
          transition-opacity pointer-events-none whitespace-nowrap
          ${isDragging ? "opacity-0" : "opacity-0 group-hover:opacity-100"}
        `}>
          <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg">
            Drag to resize
          </div>
        </div>

        {/* Quick resize buttons - show on hover */}
        <div className={`
          absolute top-4 left-1/2 -translate-x-1/2 flex flex-col gap-2
          transition-opacity pointer-events-auto
          ${isDragging ? "opacity-0 pointer-events-none" : "opacity-0 group-hover:opacity-100"}
        `}>
          {/* 25% */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLeftWidth(25);
            }}
            className="bg-white hover:bg-blue-50 border border-gray-300 hover:border-blue-400 rounded px-2 py-1 text-xs font-medium text-gray-700 hover:text-blue-700 shadow-sm transition-colors whitespace-nowrap"
            title="Set to 25%"
          >
            25%
          </button>
          {/* 50% */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLeftWidth(50);
            }}
            className="bg-white hover:bg-blue-50 border border-gray-300 hover:border-blue-400 rounded px-2 py-1 text-xs font-medium text-gray-700 hover:text-blue-700 shadow-sm transition-colors whitespace-nowrap"
            title="Set to 50%"
          >
            50%
          </button>
          {/* 75% */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLeftWidth(75);
            }}
            className="bg-white hover:bg-blue-50 border border-gray-300 hover:border-blue-400 rounded px-2 py-1 text-xs font-medium text-gray-700 hover:text-blue-700 shadow-sm transition-colors whitespace-nowrap"
            title="Set to 75%"
          >
            75%
          </button>
        </div>
      </div>

      {/* Right Panel */}
      <div
        className="overflow-hidden flex-1"
        style={{ width: `${100 - leftWidth}%` }}
      >
        {rightPanel}
      </div>

      {/* Overlay during dragging to prevent iframe/content interference */}
      {isDragging && (
        <div className="absolute inset-0 z-50 cursor-col-resize" />
      )}
    </div>
  );
}
