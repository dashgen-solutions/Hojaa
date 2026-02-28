'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

interface PricingTier {
  name: string;
  price: string;
  period: string;
  badge?: string;
  featured: boolean;
  features: string[];
  cta: string;
  ctaHref: string;
  ctaStyle: 'ghost' | 'lime';
  shape: 'circle' | 'triangle' | 'square';
}

const tiers: PricingTier[] = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    featured: false,
    features: [
      'All features included',
      'Unlimited projects',
      'Community support',
      'Self-hosted',
    ],
    cta: 'Deploy Now',
    ctaHref: '#open-source',
    ctaStyle: 'ghost',
    shape: 'circle',
  },
  {
    name: 'Managed',
    price: '$29',
    period: '/mo',
    badge: 'Coming Soon',
    featured: true,
    features: [
      'Everything in Free',
      'Managed hosting',
      'Auto-updates',
      'Email support',
    ],
    cta: 'Join Waitlist',
    ctaHref: '/register',
    ctaStyle: 'lime',
    shape: 'triangle',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'pricing',
    featured: false,
    features: [
      'Everything in Managed',
      'Custom integrations',
      'SLA guarantee',
      'Dedicated support',
      'SSO & advanced security',
    ],
    cta: 'Contact Us',
    ctaHref: 'mailto:hello@dashgen.com',
    ctaStyle: 'ghost',
    shape: 'square',
  },
];

function PricingShape({ shape, featured }: { shape: string; featured: boolean }) {
  const opacity = featured ? 'opacity-[0.08]' : 'opacity-[0.04]';

  if (shape === 'circle') {
    return (
      <motion.div
        className={`absolute -top-10 -right-10 ${opacity}`}
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
      >
        <svg width="160" height="160" viewBox="0 0 160 160" fill="none">
          <circle cx="80" cy="80" r="70" stroke="#E4FF1A" strokeWidth="3" />
          <circle cx="80" cy="80" r="45" stroke="#E4FF1A" strokeWidth="2" strokeDasharray="6 6" />
        </svg>
      </motion.div>
    );
  }

  if (shape === 'triangle') {
    return (
      <motion.div
        className={`absolute -bottom-8 -right-8 ${opacity}`}
        animate={{ rotate: [0, 10, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <svg width="180" height="180" viewBox="0 0 180 180" fill="none">
          <polygon points="90,10 170,160 10,160" fill="#E4FF1A" />
        </svg>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`absolute -top-8 -left-8 ${opacity}`}
      animate={{ rotate: [0, 15, 0] }}
      transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
    >
      <svg width="140" height="140" viewBox="0 0 140 140" fill="none">
        <rect x="15" y="15" width="110" height="110" rx="14" stroke="#E4FF1A" strokeWidth="3" />
      </svg>
    </motion.div>
  );
}

export default function Pricing() {
  return (
    <section id="pricing" className="py-24 md:py-32 px-4 sm:px-6 lg:px-8">
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
            Simple, transparent pricing
          </motion.h2>
          <motion.p
            className="mt-4 text-neutral-400 text-lg max-w-lg mx-auto"
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
          >
            Start free. Scale when you're ready.
          </motion.p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {tiers.map((tier, index) => (
            <motion.div
              key={tier.name}
              className={`relative overflow-hidden bg-neutral-900/50 rounded-2xl p-8 flex flex-col ${
                tier.featured
                  ? 'border-2 border-brand-lime shadow-[0_0_40px_-12px_rgba(228,255,26,0.15)] lg:scale-105 lg:-my-2'
                  : 'border border-neutral-800 hover:border-neutral-700'
              } transition-all duration-300`}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.5,
                delay: index * 0.1,
                ease: 'easeOut',
              }}
              whileHover={!tier.featured ? { y: -4, borderColor: 'rgba(228,255,26,0.2)' } : undefined}
            >
              {/* Decorative shape */}
              <PricingShape shape={tier.shape} featured={tier.featured} />

              {/* Badge */}
              {tier.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold text-brand-dark bg-gradient-to-r from-brand-lime to-brand-lime-dark px-4 py-1 rounded-full whitespace-nowrap">
                  {tier.badge}
                </span>
              )}

              {/* Name + Price */}
              <div className="relative z-10">
                <h3 className="font-display font-semibold text-lg text-white">
                  {tier.name}
                </h3>

                <div className="mt-4 mb-6">
                  <span className="font-display font-extrabold text-4xl text-white">
                    {tier.price}
                  </span>
                  <span className="text-neutral-400 ml-1">{tier.period}</span>
                </div>

                {/* Features list */}
                <ul className="space-y-3 mb-8 flex-1">
                  {tier.features.map((feature, i) => (
                    <motion.li
                      key={feature}
                      className="flex items-start gap-3"
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + index * 0.1 + i * 0.06, duration: 0.3 }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 18 18"
                        fill="none"
                        className="flex-shrink-0 mt-0.5"
                      >
                        <path
                          d="M4 9.5L7.5 13L14 5"
                          stroke={tier.featured ? '#E4FF1A' : '#525252'}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className={`text-sm ${tier.featured ? 'text-neutral-200' : 'text-neutral-400'}`}>
                        {feature}
                      </span>
                    </motion.li>
                  ))}
                </ul>

                {/* CTA */}
                {tier.ctaStyle === 'lime' ? (
                  <Link
                    href={tier.ctaHref}
                    className="block text-center font-semibold text-brand-dark bg-gradient-to-r from-brand-lime to-brand-lime-dark px-6 py-3 rounded-full hover:opacity-90 hover:shadow-[0_0_20px_-4px_rgba(228,255,26,0.3)] transition-all duration-200"
                  >
                    {tier.cta}
                  </Link>
                ) : (
                  <Link
                    href={tier.ctaHref}
                    className="block text-center font-semibold text-white border border-neutral-700 hover:border-brand-lime hover:text-brand-lime px-6 py-3 rounded-full transition-all duration-200"
                  >
                    {tier.cta}
                  </Link>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
