'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import FeatureRequestCard from './FeatureRequestCard';
import FeatureRequestModal from './FeatureRequestModal';
import type { FeatureRequestType } from './types';

type SortOption = 'most_voted' | 'newest';

const PAGE_SIZE = 10;

export default function FeatureRequests() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const [requests, setRequests] = useState<FeatureRequestType[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortOption>('most_voted');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchRequests = useCallback(
    async (pageNum: number, append: boolean) => {
      try {
        const sortParam = sort === 'most_voted' ? 'votes' : 'newest';
        const { data } = await api.get<{ items: FeatureRequestType[]; total: number }>('/api/roadmap/requests', {
          params: { sort: sortParam, page: pageNum, limit: PAGE_SIZE },
        });
        const items = data.items ?? [];
        if (append) {
          setRequests((prev) => [...prev, ...items]);
        } else {
          setRequests(items);
        }
        setHasMore(items.length === PAGE_SIZE);
      } catch (err) {
        console.error('Failed to fetch feature requests:', err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [sort]
  );

  // Fetch on mount and when sort changes
  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchRequests(1, false);
  }, [fetchRequests]);

  const handleLoadMore = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    setLoadingMore(true);
    fetchRequests(nextPage, true);
  }, [page, fetchRequests]);

  const handleVote = useCallback(
    async (id: string) => {
      if (!isAuthenticated) {
        router.push('/login?redirect=/roadmap');
        return;
      }

      // Optimistic update
      setRequests((prev) =>
        prev.map((req) =>
          req.id === id
            ? {
                ...req,
                user_has_voted: !req.user_has_voted,
                vote_count: req.user_has_voted
                  ? req.vote_count - 1
                  : req.vote_count + 1,
              }
            : req
        )
      );

      try {
        await api.post(`/api/roadmap/requests/${id}/vote`);
      } catch (err) {
        console.error('Failed to vote:', err);
        // Revert on failure
        setRequests((prev) =>
          prev.map((req) =>
            req.id === id
              ? {
                  ...req,
                  user_has_voted: !req.user_has_voted,
                  vote_count: req.user_has_voted
                    ? req.vote_count - 1
                    : req.vote_count + 1,
                }
              : req
          )
        );
      }
    },
    [isAuthenticated, router]
  );

  const handleSubmitRequest = useCallback(
    async (text: string) => {
      const { data } = await api.post<FeatureRequestType>('/api/roadmap/requests', {
        description: text,
      });
      // Prepend new request to list
      setRequests((prev) => [data, ...prev]);
    },
    []
  );

  const handleOpenModal = useCallback(() => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/roadmap');
      return;
    }
    setModalOpen(true);
  }, [isAuthenticated, router]);

  return (
    <section className="py-24 md:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <motion.h2
              className="font-display font-bold text-3xl md:text-4xl text-white"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              Community Requests
            </motion.h2>
            <motion.p
              className="mt-2 text-neutral-400 text-lg"
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
            >
              Submit ideas and vote for the features you want most.
            </motion.p>
          </div>
          <motion.button
            onClick={handleOpenModal}
            className="flex-shrink-0 text-sm font-semibold text-brand-dark bg-brand-lime px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity"
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
          >
            Submit a Request
          </motion.button>
        </div>

        {/* Sort toggle */}
        <motion.div
          className="flex gap-1 bg-neutral-900/50 rounded-full p-1 w-fit mb-8"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
        >
          <button
            onClick={() => setSort('most_voted')}
            className={`text-sm px-4 py-1.5 rounded-full transition-all duration-200 ${
              sort === 'most_voted'
                ? 'bg-neutral-800 text-white font-medium'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Most Voted
          </button>
          <button
            onClick={() => setSort('newest')}
            className={`text-sm px-4 py-1.5 rounded-full transition-all duration-200 ${
              sort === 'newest'
                ? 'bg-neutral-800 text-white font-medium'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Newest
          </button>
        </motion.div>

        {/* List */}
        {loading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-2 border-neutral-700 border-t-brand-lime rounded-full animate-spin mx-auto" />
            <p className="text-neutral-500 text-sm mt-4">Loading requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-neutral-500 text-sm">
              No feature requests yet. Be the first to submit one!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <FeatureRequestCard
                key={request.id}
                request={request}
                onVote={handleVote}
                isAuthenticated={isAuthenticated}
              />
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && !loading && (
          <div className="text-center mt-8">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="text-sm text-neutral-400 border border-neutral-700 hover:border-brand-lime/50 px-6 py-2.5 rounded-full transition-all duration-200 disabled:opacity-50"
            >
              {loadingMore ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>

      {/* Submit modal */}
      <FeatureRequestModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmitRequest}
      />
    </section>
  );
}
