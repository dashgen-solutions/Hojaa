'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Floating animated elements */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Circle - top right */}
        <motion.div
          className="absolute top-[15%] right-[15%] md:right-[20%]"
          animate={{ y: [0, -20, 0], rotate: [0, 15, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="opacity-20">
            <circle cx="40" cy="40" r="36" stroke="#E4FF1A" strokeWidth="3" />
          </svg>
        </motion.div>

        {/* Triangle - bottom left */}
        <motion.div
          className="absolute bottom-[20%] left-[10%] md:left-[15%]"
          animate={{ y: [0, 15, 0], x: [0, -8, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg width="60" height="60" viewBox="0 0 60 60" fill="none" className="opacity-15">
            <polygon points="5,55 30,5 55,55" fill="#E4FF1A" />
          </svg>
        </motion.div>

        {/* Arrow - center right */}
        <motion.div
          className="absolute top-[45%] right-[8%] md:right-[12%]"
          animate={{ x: [0, 25, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg width="60" height="30" viewBox="0 0 60 30" fill="none" className="opacity-20">
            <path
              d="M5,15 L45,15 M38,7 L45,15 L38,23"
              stroke="#E4FF1A"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>

        {/* Second circle - left */}
        <motion.div
          className="absolute top-[35%] left-[5%] md:left-[10%]"
          animate={{ y: [0, 12, 0], rotate: [0, -10, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg width="50" height="50" viewBox="0 0 50 50" fill="none" className="opacity-15">
            <circle cx="25" cy="25" r="22" stroke="#E4FF1A" strokeWidth="2" />
          </svg>
        </motion.div>

        {/* Dotted circle - bottom right */}
        <motion.div
          className="absolute bottom-[15%] right-[10%] md:right-[18%]"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        >
          <svg width="70" height="70" viewBox="0 0 70 70" fill="none" className="opacity-15">
            <circle
              cx="35"
              cy="35"
              r="30"
              stroke="#E4FF1A"
              strokeWidth="2"
              strokeDasharray="6 6"
            />
          </svg>
        </motion.div>
      </div>

      {/* Content */}
      <div className="relative z-10 text-center max-w-5xl mx-auto pt-32 md:pt-40">
        <motion.h1
          className="font-display font-extrabold text-6xl md:text-8xl lg:text-9xl text-white leading-none tracking-tight"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          Make it happen
        </motion.h1>

        <motion.p
          className="mt-6 md:mt-8 text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
        >
          AI-powered project scoping. From requirements to execution.
        </motion.p>

        <motion.div
          className="mt-10 md:mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
        >
          <Link
            href="/register"
            className="font-semibold text-brand-dark bg-gradient-to-r from-brand-lime to-brand-lime-dark px-8 py-3 rounded-full hover:opacity-90 transition-opacity duration-200 text-base"
          >
            Get Started
          </Link>
          <a
            href="https://github.com/DashGen-Solutions/hojaa"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-white border border-neutral-700 hover:border-brand-lime px-8 py-3 rounded-full transition-colors duration-200 text-base"
          >
            View on GitHub
          </a>
        </motion.div>

        {/* Video Section */}
        <motion.div
          className="mt-16 md:mt-20 w-full max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }}
        >
          <div className="relative aspect-video rounded-2xl border border-neutral-800 bg-neutral-900/50 overflow-hidden backdrop-blur-sm">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-brand-lime/20 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-brand-lime ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <p className="text-neutral-500 text-sm">Product demo coming soon</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
