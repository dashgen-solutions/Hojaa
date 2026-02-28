'use client';

import { motion } from 'framer-motion';

const features = [
  {
    title: 'Requirements Discovery',
    description:
      'Upload documents, answer AI-driven questions, and build a complete scope tree automatically.',
    shape: 'circle' as const,
  },
  {
    title: 'Scope Management',
    description:
      'Track every change. Every decision attributed to its source. Full audit trail with nothing lost.',
    shape: 'triangle' as const,
  },
  {
    title: 'Project Planning',
    description:
      'Kanban boards, team assignment, and estimation — all connected to your scope tree.',
    shape: 'square' as const,
  },
  {
    title: 'AI Document Generation',
    description:
      'Generate proposals, SOWs, and contracts powered by AI with your project\'s actual data.',
    shape: 'arrow' as const,
  },
];

function ShapeBackground({ shape, index }: { shape: string; index: number }) {
  const delay = index * 2;

  if (shape === 'circle') {
    return (
      <div className="absolute -top-8 -right-8 opacity-[0.07]">
        <motion.svg
          width="200"
          height="200"
          viewBox="0 0 200 200"
          fill="none"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear', delay }}
        >
          <circle cx="100" cy="100" r="90" stroke="#E4FF1A" strokeWidth="4" />
          <circle cx="100" cy="100" r="60" stroke="#E4FF1A" strokeWidth="2" strokeDasharray="8 8" />
        </motion.svg>
      </div>
    );
  }

  if (shape === 'triangle') {
    return (
      <div className="absolute -bottom-6 -right-6 opacity-[0.07]">
        <motion.svg
          width="180"
          height="180"
          viewBox="0 0 180 180"
          fill="none"
          animate={{ rotate: [0, -15, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay }}
        >
          <polygon points="90,10 170,160 10,160" fill="#E4FF1A" />
        </motion.svg>
      </div>
    );
  }

  if (shape === 'square') {
    return (
      <div className="absolute -top-6 -left-6 opacity-[0.07]">
        <motion.svg
          width="160"
          height="160"
          viewBox="0 0 160 160"
          fill="none"
          animate={{ rotate: [0, 45, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay }}
        >
          <rect x="20" y="20" width="120" height="120" rx="12" stroke="#E4FF1A" strokeWidth="4" />
        </motion.svg>
      </div>
    );
  }

  // arrow
  return (
    <div className="absolute -bottom-4 -left-4 opacity-[0.07]">
      <motion.svg
        width="180"
        height="100"
        viewBox="0 0 180 100"
        fill="none"
        animate={{ x: [0, 20, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay }}
      >
        <path
          d="M10,50 L140,50 M120,25 L145,50 L120,75"
          stroke="#E4FF1A"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.svg>
    </div>
  );
}

function ShapeIcon({ shape }: { shape: string }) {
  if (shape === 'circle') {
    return (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="11" stroke="#E4FF1A" strokeWidth="2" />
        <circle cx="14" cy="14" r="4" fill="#E4FF1A" />
      </svg>
    );
  }

  if (shape === 'triangle') {
    return (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <polygon points="14,3 25,24 3,24" stroke="#E4FF1A" strokeWidth="2" fill="none" />
      </svg>
    );
  }

  if (shape === 'square') {
    return (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect x="4" y="4" width="20" height="20" rx="3" stroke="#E4FF1A" strokeWidth="2" />
        <rect x="10" y="10" width="8" height="8" rx="1" fill="#E4FF1A" />
      </svg>
    );
  }

  // arrow
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path
        d="M5,14 L20,14 M15,8 L21,14 L15,20"
        stroke="#E4FF1A"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Features() {
  return (
    <section id="features" className="py-24 md:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Section heading */}
        <div className="text-center mb-16 md:mb-20">
          <motion.h2
            className="font-display font-bold text-3xl md:text-4xl text-white"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            Everything you need to ship projects
          </motion.h2>
          <motion.p
            className="mt-4 text-neutral-400 text-lg max-w-xl mx-auto"
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
          >
            One platform for scoping, planning, tracking, and documenting.
          </motion.p>
        </div>

        {/* Feature cards with geometric shapes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="relative overflow-hidden bg-neutral-900/50 border border-neutral-800 rounded-2xl p-8 hover:border-brand-lime/30 transition-all duration-500 group"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.5,
                delay: index * 0.1,
                ease: 'easeOut',
              }}
            >
              {/* Animated geometric shape background */}
              <ShapeBackground shape={feature.shape} index={index} />

              {/* Content */}
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-neutral-800/80 flex items-center justify-center mb-5 group-hover:bg-neutral-700/80 transition-colors">
                  <ShapeIcon shape={feature.shape} />
                </div>
                <h3 className="font-display font-semibold text-xl text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-neutral-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
