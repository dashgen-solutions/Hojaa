'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

const codeLines = [
  { cmd: 'git clone https://github.com/DashGen-Solutions/hojaa.git', delay: 0 },
  { cmd: 'cd hojaa', delay: 0.6 },
  { cmd: 'cp .env.example .env', delay: 1.0 },
  { cmd: 'docker compose up -d', delay: 1.4 },
];

const stats = [
  { label: 'Open Source', value: 'MIT', icon: '🔓' },
  { label: 'Setup Time', value: '<2 min', icon: '⚡' },
  { label: 'Your Data', value: '100%', icon: '🔒' },
];

const deploymentOptions = [
  { name: 'Docker', icon: '🐳' },
  { name: 'Railway', icon: '🚂' },
  { name: 'Vercel', icon: '▲' },
  { name: 'Self-hosted', icon: '🖥️' },
];

export default function OpenSource() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const commands = codeLines.map(l => l.cmd).join('\n');
    navigator.clipboard.writeText(commands).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <section id="open-source" className="py-24 md:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Section heading */}
        <div className="text-center mb-12 md:mb-16">
          <motion.h2
            className="font-display font-bold text-3xl md:text-4xl text-white"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            Open source. Self-hostable.
            <br />
            <span className="text-neutral-400">Your data, your rules.</span>
          </motion.h2>
          <motion.p
            className="mt-4 text-neutral-400 text-lg max-w-xl mx-auto"
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
          >
            Deploy Hojaa anywhere with Docker in under 2 minutes.
          </motion.p>
        </div>

        {/* Stats row */}
        <motion.div
          className="grid grid-cols-3 gap-4 mb-10"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="text-center p-4 rounded-xl bg-neutral-900/50 border border-neutral-800 hover:border-brand-lime/30 transition-colors duration-300"
            >
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="font-display font-bold text-xl text-white">{stat.value}</div>
              <div className="text-xs text-neutral-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Code block with copy button */}
        <motion.div
          className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden group"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
        >
          {/* Terminal header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
              <span className="ml-2 text-xs text-neutral-500 font-mono">terminal</span>
            </div>
            <button
              onClick={handleCopy}
              className="text-xs text-neutral-500 hover:text-brand-lime px-2 py-1 rounded hover:bg-neutral-800 transition-colors font-mono"
            >
              {copied ? '✓ copied' : 'copy'}
            </button>
          </div>

          {/* Code content with staggered animation */}
          <pre className="p-6 overflow-x-auto">
            <code className="font-mono text-sm md:text-base leading-loose">
              {codeLines.map((line, index) => (
                <motion.span
                  key={index}
                  className="block"
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.4,
                    delay: 0.3 + line.delay,
                    ease: 'easeOut',
                  }}
                >
                  <span className="text-neutral-500 select-none">$ </span>
                  <span className="text-brand-lime">{line.cmd}</span>
                </motion.span>
              ))}
              <motion.span
                className="block mt-2"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 2.2, duration: 0.5 }}
              >
                <span className="text-green-400">✓ All containers healthy. Hojaa is running on localhost:3000</span>
              </motion.span>
            </code>
          </pre>
        </motion.div>

        {/* Deployment options */}
        <motion.div
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
        >
          <span className="text-sm text-neutral-500 mr-2">Deploy on:</span>
          {deploymentOptions.map((option, i) => (
            <motion.span
              key={option.name}
              className="text-xs font-medium text-neutral-300 bg-neutral-800/80 border border-neutral-700 hover:border-brand-lime/50 hover:text-white px-4 py-2 rounded-full cursor-default transition-all duration-200 flex items-center gap-1.5"
              whileHover={{ scale: 1.05, y: -2 }}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 + i * 0.08, duration: 0.3 }}
            >
              <span>{option.icon}</span>
              {option.name}
            </motion.span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
