'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FeatureRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
}

const MAX_CHARS = 2000;

export default function FeatureRequestModal({
  isOpen,
  onClose,
  onSubmit,
}: FeatureRequestModalProps) {
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setText('');
      setSubmitted(false);
      setSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(text.trim());
      setSubmitted(true);
    } catch {
      setSubmitting(false);
    }
  }, [text, submitting, onSubmit]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleOverlayClick}
        >
          <motion.div
            className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-lg w-full mt-20"
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {submitted ? (
              /* Success state */
              <motion.div
                className="text-center py-8"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 28 28"
                    fill="none"
                  >
                    <path
                      d="M7 14L12 19L21 10"
                      stroke="#4ade80"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className="font-display font-semibold text-lg text-white mb-2">
                  Thank you!
                </h3>
                <p className="text-neutral-400 text-sm">
                  Your request has been submitted.
                </p>
                <button
                  onClick={onClose}
                  className="mt-6 text-sm text-neutral-500 hover:text-white transition-colors"
                >
                  Close
                </button>
              </motion.div>
            ) : (
              /* Form state */
              <>
                <h3 className="font-display font-semibold text-lg text-white mb-4">
                  Submit a Feature Request
                </h3>

                <textarea
                  value={text}
                  onChange={(e) => {
                    if (e.target.value.length <= MAX_CHARS) {
                      setText(e.target.value);
                    }
                  }}
                  placeholder="Describe the feature you'd like to see in Hojaa..."
                  className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl p-4 text-white text-sm placeholder-neutral-500 resize-none focus:outline-none focus:border-brand-lime/50 transition-colors"
                  style={{ minHeight: '150px' }}
                  maxLength={MAX_CHARS}
                />

                <div className="flex items-center justify-end mt-2">
                  <span className="text-xs text-neutral-500">
                    {text.length}/{MAX_CHARS}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-3 mt-4">
                  <button
                    onClick={onClose}
                    className="text-sm text-neutral-400 hover:text-white px-4 py-2 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!text.trim() || submitting}
                    className="text-sm font-semibold text-brand-dark bg-brand-lime px-5 py-2 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
