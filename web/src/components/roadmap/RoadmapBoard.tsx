'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import RoadmapCard from './RoadmapCard';
import type { RoadmapItemType } from './types';
import { CATEGORY_LABELS } from './types';

type StatusKey = 'planned' | 'in_progress' | 'shipped';

const STATUS_COLUMNS: { key: StatusKey; label: string }[] = [
  { key: 'planned', label: 'Planned' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'shipped', label: 'Shipped' },
];

const ALL_CATEGORIES = ['all', ...Object.keys(CATEGORY_LABELS)];

export default function RoadmapBoard() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<RoadmapItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeTab, setActiveTab] = useState<StatusKey>('planned');

  useEffect(() => {
    let cancelled = false;

    async function fetchItems() {
      try {
        const { data } = await api.get<RoadmapItemType[]>('/api/roadmap/items');
        if (!cancelled) {
          setItems(data);
        }
      } catch (err) {
        console.error('Failed to fetch roadmap items:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchItems();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleVote = useCallback(
    async (id: string) => {
      if (!isAuthenticated) {
        router.push('/login?redirect=/roadmap');
        return;
      }

      // Optimistic update
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                user_has_voted: !item.user_has_voted,
                vote_count: item.user_has_voted
                  ? item.vote_count - 1
                  : item.vote_count + 1,
              }
            : item
        )
      );

      try {
        await api.post(`/api/roadmap/items/${id}/vote`);
      } catch (err) {
        console.error('Failed to vote:', err);
        // Revert on failure
        setItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  user_has_voted: !item.user_has_voted,
                  vote_count: item.user_has_voted
                    ? item.vote_count - 1
                    : item.vote_count + 1,
                }
              : item
          )
        );
      }
    },
    [isAuthenticated, router]
  );

  const filteredItems = useMemo(() => {
    if (selectedCategory === 'all') return items;
    return items.filter((item) => item.category === selectedCategory);
  }, [items, selectedCategory]);

  const columnItems = useMemo(
    () => ({
      planned: filteredItems.filter((i) => i.status === 'planned'),
      in_progress: filteredItems.filter((i) => i.status === 'in_progress'),
      shipped: filteredItems.filter((i) => i.status === 'shipped'),
    }),
    [filteredItems]
  );

  return (
    <section className="py-24 md:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Section heading */}
        <motion.h2
          className="font-display font-bold text-3xl md:text-4xl text-white mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          Roadmap
        </motion.h2>

        {/* Category filter pills */}
        <motion.div
          className="flex gap-2 overflow-x-auto pb-4 mb-8 scrollbar-hide"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
        >
          {ALL_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat;
            const label = cat === 'all' ? 'All' : CATEGORY_LABELS[cat] || cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex-shrink-0 rounded-full px-4 py-2 text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-lime text-brand-dark font-semibold'
                    : 'bg-neutral-800/80 border border-neutral-700 text-neutral-300 hover:border-brand-lime/50'
                }`}
              >
                {label}
              </button>
            );
          })}
        </motion.div>

        {/* Mobile tabs */}
        <div className="md:hidden flex gap-1 mb-6 bg-neutral-900/50 rounded-xl p-1">
          {STATUS_COLUMNS.map((col) => (
            <button
              key={col.key}
              onClick={() => setActiveTab(col.key)}
              className={`flex-1 text-sm font-medium py-2 rounded-lg transition-all duration-200 ${
                activeTab === col.key
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {col.label}
            </button>
          ))}
        </div>

        {/* Desktop 3-column grid / Mobile single column */}
        {loading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-2 border-neutral-700 border-t-brand-lime rounded-full animate-spin mx-auto" />
            <p className="text-neutral-500 text-sm mt-4">Loading roadmap...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STATUS_COLUMNS.map((col) => {
              const isMobileVisible = activeTab === col.key;
              return (
                <div
                  key={col.key}
                  className={`${isMobileVisible ? 'block' : 'hidden'} md:block`}
                >
                  {/* Column header */}
                  <div className="flex items-center gap-2 mb-4">
                    {col.key === 'planned' && (
                      <span className="w-2.5 h-2.5 rounded-full bg-neutral-400" />
                    )}
                    {col.key === 'in_progress' && (
                      <span className="w-2.5 h-2.5 rounded-full bg-brand-lime animate-pulse-soft" />
                    )}
                    {col.key === 'shipped' && (
                      <span className="relative w-2.5 h-2.5 rounded-full bg-green-400 flex items-center justify-center">
                        <svg
                          width="8"
                          height="8"
                          viewBox="0 0 8 8"
                          fill="none"
                          className="absolute"
                        >
                          <path
                            d="M1.5 4L3.5 6L6.5 2"
                            stroke="white"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    )}
                    <h3 className="font-display font-semibold text-sm text-white">
                      {col.label}
                    </h3>
                    <span className="text-2xs text-neutral-600 ml-1">
                      {columnItems[col.key].length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="space-y-3">
                    {columnItems[col.key].length > 0 ? (
                      columnItems[col.key].map((item) => (
                        <RoadmapCard
                          key={item.id}
                          item={item}
                          onVote={handleVote}
                          isAuthenticated={isAuthenticated}
                        />
                      ))
                    ) : (
                      <div className="text-center py-8 text-neutral-600 text-sm">
                        No items yet
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
