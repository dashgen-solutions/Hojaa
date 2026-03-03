'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

type FeedbackType = 'idea' | 'pain_point' | 'praise' | 'bug' | 'other';

const FEEDBACK_TYPES: { key: FeedbackType; label: string }[] = [
  { key: 'idea', label: 'Idea' },
  { key: 'pain_point', label: 'Pain Point' },
  { key: 'praise', label: 'Praise' },
  { key: 'bug', label: 'Bug' },
  { key: 'other', label: 'Other' },
];

const MAX_CHARS = 2000;

export default function FeedbackSection() {
  const { isAuthenticated } = useAuth();

  const [feedbackType, setFeedbackType] = useState<FeedbackType>('idea');
  const [text, setText] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!text.trim() || submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      await api.post('/api/roadmap/feedback', {
        feedback_type: feedbackType,
        content: text.trim(),
        ...(!isAuthenticated && email.trim() ? { email: email.trim() } : {}),
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [text, feedbackType, email, isAuthenticated, submitting]);

  const handleReset = useCallback(() => {
    setText('');
    setEmail('');
    setFeedbackType('idea');
    setSubmitted(false);
    setError(null);
  }, []);

  return (
    <section className="py-24 md:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Heading */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <h2 className="font-display font-bold text-3xl md:text-4xl text-white">
            Your Voice
          </h2>
          <p className="mt-3 text-neutral-400 text-lg">
            Tell us what&apos;s on your mind. Pain points, ideas, or just say hi.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {submitted ? (
            /* Success state */
            <motion.div
              key="success"
              className="text-center py-12"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <div className="w-14 h-14 rounded-full bg-brand-lime/10 flex items-center justify-center mx-auto mb-4">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 28 28"
                  fill="none"
                >
                  <path
                    d="M7 14L12 19L21 10"
                    stroke="#E4FF1A"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className="font-display font-semibold text-lg text-white mb-2">
                Thanks for sharing!
              </h3>
              <p className="text-neutral-400 text-sm mb-6">
                We read every piece of feedback.
              </p>
              <button
                onClick={handleReset}
                className="text-sm text-neutral-500 hover:text-white transition-colors"
              >
                Send another
              </button>
            </motion.div>
          ) : (
            /* Form state */
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
            >
              {/* Feedback type selector */}
              <div className="flex flex-wrap gap-2 mb-6">
                {FEEDBACK_TYPES.map((type) => {
                  const isActive = feedbackType === type.key;
                  return (
                    <button
                      key={type.key}
                      onClick={() => setFeedbackType(type.key)}
                      className={`text-sm px-4 py-2 rounded-full border transition-all duration-200 ${
                        isActive
                          ? 'bg-brand-lime/10 border-brand-lime text-brand-lime'
                          : 'bg-neutral-800/50 border-neutral-700 text-neutral-400 hover:border-neutral-600'
                      }`}
                    >
                      {type.label}
                    </button>
                  );
                })}
              </div>

              {/* Textarea */}
              <textarea
                value={text}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_CHARS) {
                    setText(e.target.value);
                  }
                }}
                placeholder="What would make Hojaa better for you?"
                className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl p-4 text-white text-sm placeholder-neutral-500 resize-none focus:outline-none focus:border-brand-lime/50 transition-colors"
                style={{ minHeight: '150px' }}
                maxLength={MAX_CHARS}
              />

              <div className="flex items-center justify-end mt-1 mb-4">
                <span className="text-xs text-neutral-500">
                  {text.length}/{MAX_CHARS}
                </span>
              </div>

              {/* Email field (shown only for unauthenticated users) */}
              {!isAuthenticated && (
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email (optional, for follow-ups)"
                  className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg p-3 text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-brand-lime/50 transition-colors mb-4"
                />
              )}

              {/* Error message */}
              {error && (
                <p className="text-sm text-red-400 mb-4">{error}</p>
              )}

              {/* Submit button */}
              <button
                onClick={handleSubmit}
                disabled={!text.trim() || submitting}
                className="text-sm font-semibold text-brand-dark bg-brand-lime px-6 py-2.5 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Sending...' : 'Send Feedback'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
