'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';

interface SignaturePadProps {
  onSignatureCapture: (dataUrl: string, type: 'draw' | 'typed') => void;
  signerName: string;
  disabled?: boolean;
}

export default function SignaturePad({ onSignatureCapture, signerName, disabled }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<'draw' | 'typed'>('draw');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [typedName, setTypedName] = useState(signerName);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#1a1a2e';
    }
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled || mode !== 'draw') return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasDrawn(false);
  };

  const captureSignature = () => {
    if (mode === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) return;
      const dataUrl = canvas.toDataURL('image/png');
      onSignatureCapture(dataUrl, 'draw');
    } else {
      if (!typedName.trim()) return;
      const offscreen = document.createElement('canvas');
      offscreen.width = 600;
      offscreen.height = 160;
      const ctx = offscreen.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 600, 160);
      ctx.fillStyle = '#1a1a2e';
      ctx.font = 'italic 48px "Dancing Script", "Brush Script MT", "Segoe Script", cursive';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(typedName.trim(), 300, 80);
      const dataUrl = offscreen.toDataURL('image/png');
      onSignatureCapture(dataUrl, 'typed');
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex rounded-lg border border-neutral-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setMode('draw')}
          disabled={disabled}
          className={`flex-1 py-2.5 text-sm font-medium transition-all ${
            mode === 'draw'
              ? 'bg-neutral-900 text-white'
              : 'bg-white text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          <svg className="inline-block w-4 h-4 mr-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          Draw
        </button>
        <button
          type="button"
          onClick={() => setMode('typed')}
          disabled={disabled}
          className={`flex-1 py-2.5 text-sm font-medium transition-all border-l border-neutral-200 ${
            mode === 'typed'
              ? 'bg-neutral-900 text-white'
              : 'bg-white text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          <svg className="inline-block w-4 h-4 mr-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Type
        </button>
      </div>

      {/* Draw mode */}
      {mode === 'draw' && (
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="w-full h-40 border-2 border-dashed border-neutral-300 rounded-xl bg-white cursor-crosshair touch-none"
            style={{ touchAction: 'none' }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          {!hasDrawn && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-neutral-400 text-sm">Sign here with your mouse or finger</p>
            </div>
          )}
          <button
            type="button"
            onClick={clearCanvas}
            disabled={disabled || !hasDrawn}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/80 border border-neutral-200 text-neutral-500 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}

      {/* Type mode */}
      {mode === 'typed' && (
        <div className="space-y-3">
          <input
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            disabled={disabled}
            placeholder="Type your full name"
            className="w-full px-4 py-3 border border-neutral-200 rounded-xl text-lg focus:ring-2 focus:ring-neutral-900 focus:border-transparent outline-none transition-all"
          />
          {typedName.trim() && (
            <div className="h-40 border-2 border-dashed border-neutral-300 rounded-xl bg-white flex items-center justify-center">
              <p
                className="text-4xl text-[#1a1a2e] select-none"
                style={{ fontFamily: '"Dancing Script", "Brush Script MT", "Segoe Script", cursive', fontStyle: 'italic' }}
              >
                {typedName}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Confirm button */}
      <button
        type="button"
        onClick={captureSignature}
        disabled={disabled || (mode === 'draw' ? !hasDrawn : !typedName.trim())}
        className="w-full py-3 rounded-xl font-semibold text-white bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        Apply Signature
      </button>
    </div>
  );
}
