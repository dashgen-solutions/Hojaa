'use client';

import { motion } from 'framer-motion';

const steps = [
  {
    number: '1',
    title: 'Upload & Discover',
    description:
      'Drop your documents. AI generates targeted questions to fill the gaps.',
  },
  {
    number: '2',
    title: 'Scope & Plan',
    description:
      'Build your scope tree. Break it into planning cards. Assign your team.',
  },
  {
    number: '3',
    title: 'Export & Deliver',
    description:
      'Generate proposals, SOWs, and reports. Track everything in audit trails.',
  },
];

function ArrowDropAnimation({ index, delay }: { index: number; delay: number }) {
  return (
    <div className="relative w-full flex flex-col items-center mb-6">
      {/* Arrowhead drops down */}
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{
          duration: 0.6,
          delay: delay,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <svg width="32" height="24" viewBox="0 0 32 24" fill="none">
          <path
            d="M4,4 L16,20 L28,4"
            stroke="#E4FF1A"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </motion.div>

      {/* Vertical line extending down */}
      <motion.div
        className="w-0.5 bg-gradient-to-b from-brand-lime to-brand-lime/0"
        initial={{ height: 0 }}
        whileInView={{ height: 32 }}
        viewport={{ once: true }}
        transition={{
          duration: 0.4,
          delay: delay + 0.3,
          ease: 'easeOut',
        }}
      />

      {/* Circle with number drops in */}
      <motion.div
        className="relative"
        initial={{ scale: 0, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{
          duration: 0.5,
          delay: delay + 0.5,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        {/* Glow ring */}
        <motion.div
          className="absolute inset-0 rounded-full bg-brand-lime/10"
          style={{ margin: '-8px' }}
          initial={{ scale: 0 }}
          whileInView={{ scale: 1.4 }}
          viewport={{ once: true }}
          transition={{
            duration: 0.8,
            delay: delay + 0.6,
            ease: 'easeOut',
          }}
        />
        {/* Number circle */}
        <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-brand-lime to-brand-lime-dark flex items-center justify-center">
          <span className="font-display font-extrabold text-2xl text-brand-dark">
            {index + 1}
          </span>
        </div>
      </motion.div>
    </div>
  );
}

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 md:py-32 px-4 sm:px-6 lg:px-8">
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
            Three steps to clarity
          </motion.h2>
        </div>

        {/* Steps with arrow-drop animation */}
        <div className="relative">
          {/* Connecting dashed line — runs through the number circles (desktop only) */}
          <motion.div
            className="hidden lg:block absolute top-[130px] left-[20%] right-[20%] h-px"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 1.5, ease: 'easeOut' }}
            style={{ transformOrigin: 'left' }}
          >
            <div className="w-full h-px border-t-2 border-dashed border-brand-lime/20" />
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-8">
            {steps.map((step, index) => (
              <div key={step.number} className="flex flex-col items-center text-center">
                <ArrowDropAnimation index={index} delay={index * 0.3} />

                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.5,
                    delay: index * 0.3 + 0.8,
                    ease: 'easeOut',
                  }}
                >
                  <h3 className="font-display font-semibold text-xl text-white mb-3">
                    {step.title}
                  </h3>
                  <p className="text-neutral-400 leading-relaxed max-w-xs mx-auto">
                    {step.description}
                  </p>
                </motion.div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
