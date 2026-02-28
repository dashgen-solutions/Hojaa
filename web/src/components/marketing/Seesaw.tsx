'use client';

import { motion } from 'framer-motion';

const scatteredTools = [
  { name: 'Slack', x: 10, y: 20 },
  { name: 'Jira', x: 55, y: 15 },
  { name: 'Notion', x: 25, y: 55 },
  { name: 'Sheets', x: 70, y: 50 },
  { name: 'Docs', x: 40, y: 35 },
  { name: 'Email', x: 80, y: 25 },
  { name: 'Trello', x: 15, y: 75 },
  { name: 'Figma', x: 65, y: 75 },
];

export default function Seesaw() {
  return (
    <section className="py-24 md:py-32 px-4 sm:px-6 lg:px-8">
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
            Stop juggling. Start shipping.
          </motion.h2>
          <motion.p
            className="mt-4 text-neutral-400 text-lg max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
          >
            Requirements are scattered across tools. Hojaa brings balance.
          </motion.p>
        </div>

        {/* Seesaw visualization */}
        <div className="relative max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-0 items-end">
            {/* Left side: The Problem — scattered tools */}
            <motion.div
              className="relative"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="text-center md:text-right mb-8">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">The problem</span>
                <h3 className="font-display font-bold text-xl text-white mt-2">Scattered requirements</h3>
              </div>

              {/* Chaotic tool pills floating */}
              <div className="relative h-48 md:h-56">
                {scatteredTools.map((tool, i) => (
                  <motion.div
                    key={tool.name}
                    className="absolute"
                    style={{ left: `${tool.x}%`, top: `${tool.y}%` }}
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.08, duration: 0.4 }}
                  >
                    <motion.div
                      className="px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-800/80 text-neutral-400 border border-neutral-700/50 whitespace-nowrap"
                      animate={{
                        y: [0, -4 + (i % 3) * 3, 0],
                        rotate: [0, (i % 2 === 0 ? 3 : -3), 0],
                      }}
                      transition={{
                        duration: 3 + (i % 2),
                        repeat: Infinity,
                        ease: 'easeInOut',
                        delay: i * 0.2,
                      }}
                    >
                      {tool.name}
                    </motion.div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Right side: The Solution — Hojaa */}
            <motion.div
              className="relative"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <div className="text-center md:text-left mb-8">
                <span className="text-xs font-semibold text-brand-lime uppercase tracking-wider">The solution</span>
                <h3 className="font-display font-bold text-xl text-white mt-2">One source of truth</h3>
              </div>

              {/* Organized structure */}
              <div className="relative h-48 md:h-56 flex items-center justify-center">
                <motion.div
                  className="relative"
                  initial={{ scale: 0.8, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.6, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* Central Hojaa card */}
                  <div className="relative bg-neutral-900/80 border border-brand-lime/30 rounded-2xl p-6 text-center backdrop-blur-sm">
                    <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-gradient-to-br from-brand-lime to-brand-lime-dark flex items-center justify-center" style={{ transform: 'rotate(-3deg)' }}>
                      <svg width="28" height="28" viewBox="0 0 56 56" fill="none">
                        <circle cx="35" cy="19" r="11" fill="none" stroke="#111" strokeWidth="2.5" />
                        <g transform="translate(8, 13)">
                          <path d="M4 8h16M14 2l6 6-6 6" stroke="#111" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </g>
                        <polygon points="0,-7 -8,7 8,7" transform="translate(16,38) rotate(-15)" fill="#111" />
                      </svg>
                    </div>
                    <span className="font-display font-extrabold text-lg text-white">hojaa</span>

                    {/* Connected items orbiting */}
                    {['Scope', 'Plan', 'Export'].map((item, i) => {
                      const angles = [-45, 0, 45];
                      const angle = angles[i];
                      const rad = (angle * Math.PI) / 180;
                      const r = 90;
                      const x = Math.cos(rad) * r + 48;
                      const y = Math.sin(rad) * r / 1.5 - 10;

                      return (
                        <motion.div
                          key={item}
                          className="absolute"
                          style={{ right: `-${70 + i * 10}px`, top: `${20 + i * 30}px` }}
                          initial={{ opacity: 0, x: -10 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.9 + i * 0.15 }}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-px bg-brand-lime/30" />
                            <span className="text-xs font-medium text-brand-lime/70 whitespace-nowrap">{item}</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>

          {/* Seesaw base — triangle */}
          <motion.div
            className="flex justify-center -mt-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <svg width="100%" height="60" viewBox="0 0 800 60" fill="none" className="max-w-2xl">
              {/* Seesaw beam — tilted toward Hojaa (right side up) */}
              <motion.line
                x1="100"
                y1="20"
                x2="700"
                y2="8"
                stroke="#E4FF1A"
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 0.4 }}
                viewport={{ once: true }}
                transition={{ delay: 0.8 }}
              />
              {/* Fulcrum triangle */}
              <polygon
                points="370,10 400,55 340,55"
                fill="#E4FF1A"
                opacity="0.15"
              />
              <polygon
                points="370,10 400,55 340,55"
                stroke="#E4FF1A"
                strokeWidth="2"
                fill="none"
                opacity="0.3"
              />
            </svg>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
