'use client';

import { motion } from 'framer-motion';

export default function RoadmapHero() {
  return (
    <section className="relative flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pt-32 md:pt-40 pb-16 overflow-hidden">
      {/* Floating animated geometric shapes */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Circle - top right */}
        <motion.div
          className="absolute top-[18%] right-[12%] md:right-[18%]"
          animate={{ y: [0, -18, 0], rotate: [0, 12, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg width="70" height="70" viewBox="0 0 70 70" fill="none" className="opacity-20">
            <circle cx="35" cy="35" r="30" stroke="#E4FF1A" strokeWidth="2.5" />
          </svg>
        </motion.div>

        {/* Triangle - bottom left */}
        <motion.div
          className="absolute bottom-[10%] left-[8%] md:left-[14%]"
          animate={{ y: [0, 14, 0], x: [0, -6, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg width="55" height="55" viewBox="0 0 55 55" fill="none" className="opacity-15">
            <polygon points="5,50 27.5,5 50,50" fill="#E4FF1A" />
          </svg>
        </motion.div>

        {/* Small circle - left */}
        <motion.div
          className="absolute top-[40%] left-[6%] md:left-[10%]"
          animate={{ y: [0, 10, 0], rotate: [0, -8, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="opacity-15">
            <circle cx="20" cy="20" r="16" stroke="#E4FF1A" strokeWidth="2" />
          </svg>
        </motion.div>

        {/* Dotted circle - right */}
        <motion.div
          className="absolute top-[50%] right-[6%] md:right-[10%]"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        >
          <svg width="60" height="60" viewBox="0 0 60 60" fill="none" className="opacity-15">
            <circle
              cx="30"
              cy="30"
              r="25"
              stroke="#E4FF1A"
              strokeWidth="2"
              strokeDasharray="5 5"
            />
          </svg>
        </motion.div>

        {/* Arrow - center right area */}
        <motion.div
          className="absolute top-[30%] right-[5%] md:right-[8%]"
          animate={{ x: [0, 20, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg width="50" height="25" viewBox="0 0 50 25" fill="none" className="opacity-20">
            <path
              d="M5,12.5 L38,12.5 M32,6 L38,12.5 L32,19"
              stroke="#E4FF1A"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>
      </div>

      {/* Content */}
      <div className="relative z-10 text-center max-w-4xl mx-auto">
        <motion.h1
          className="font-display font-extrabold text-5xl md:text-7xl text-white leading-none tracking-tight"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          What We&apos;re Building
        </motion.h1>

        <motion.p
          className="mt-6 text-neutral-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
        >
          See what&apos;s coming next. Vote on what matters. Shape the future of Hojaa.
        </motion.p>
      </div>

      {/* Subtle animated lime gradient line at the bottom */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-px"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.5 }}
      >
        <div className="h-full bg-gradient-to-r from-transparent via-brand-lime/40 to-transparent" />
      </motion.div>
    </section>
  );
}
