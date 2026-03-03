'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import type { RoadmapStats as RoadmapStatsType } from './types';

const statItems = [
  { key: 'planned' as const, label: 'Features Planned' },
  { key: 'in_progress' as const, label: 'In Progress' },
  { key: 'shipped' as const, label: 'Shipped' },
  { key: 'total_votes' as const, label: 'Community Votes' },
];

export default function RoadmapStats() {
  const [stats, setStats] = useState<RoadmapStatsType>({
    planned: 0,
    in_progress: 0,
    shipped: 0,
    total_votes: 0,
    total_requests: 0,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      try {
        const { data } = await api.get<RoadmapStatsType>('/api/roadmap/stats');
        if (!cancelled) {
          setStats(data);
        }
      } catch (err) {
        // Silently fail - stats will show 0
        console.error('Failed to fetch roadmap stats:', err);
      }
    }

    fetchStats();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statItems.map((item, index) => (
            <motion.div
              key={item.key}
              className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1, ease: 'easeOut' }}
            >
              <div className="font-display font-bold text-3xl text-white">
                {stats[item.key]}
              </div>
              <div className="text-sm text-neutral-500 mt-1">{item.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
