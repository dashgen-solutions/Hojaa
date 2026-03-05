'use client';

import Link from 'next/link';
import HojaaLogo from '@/components/brand/HojaaLogo';

const footerLinks = {
  Product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Open Source', href: '#open-source' },
    { label: 'Roadmap', href: '/roadmap' },
  ],
  Company: [
    { label: 'About', href: '#' },
    { label: 'Blog', href: '#' },
  ],
  Resources: [
    { label: 'Docs', href: '#' },
    { label: 'GitHub', href: 'https://github.com/dashgen-solutions/hojaa' },
    { label: 'Support', href: '#' },
  ],
};

export default function MarketingFooter() {
  return (
    <footer className="border-t border-neutral-800 pt-16 pb-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <HojaaLogo size={32} showText textClassName="text-lg text-white" />
            <p className="mt-4 text-neutral-400 text-sm max-w-xs">
              Make it happen. AI-powered project scoping from requirements to execution.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-display font-semibold text-sm text-white mb-4">
                {category}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith('http') ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-neutral-400 hover:text-white transition-colors duration-200"
                      >
                        {link.label}
                      </a>
                    ) : link.href.startsWith('#') ? (
                      <a
                        href={link.href}
                        className="text-sm text-neutral-400 hover:text-white transition-colors duration-200"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-neutral-400 hover:text-white transition-colors duration-200"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-neutral-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-neutral-500">
            &copy; 2026 Hojaa. Built by DashGen Solutions.
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="#"
              className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors duration-200"
            >
              Privacy
            </Link>
            <Link
              href="#"
              className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors duration-200"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
