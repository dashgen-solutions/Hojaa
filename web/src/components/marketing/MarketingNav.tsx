'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import HojaaLogo from '@/components/brand/HojaaLogo';

export default function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'Open Source', href: '#open-source' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Roadmap', href: '/roadmap' },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-brand-dark/80 backdrop-blur-md border-b border-neutral-800/50'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Left: Logo */}
          <Link href="/" className="flex-shrink-0">
            <HojaaLogo size={32} showText textClassName="text-lg text-white" />
          </Link>

          {/* Center/Right: Nav links (desktop) */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) =>
              link.href.startsWith('/') ? (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-neutral-300 hover:text-white transition-colors duration-200"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm text-neutral-300 hover:text-white transition-colors duration-200"
                >
                  {link.label}
                </a>
              )
            )}
          </div>

          {/* Right: CTA buttons (desktop) */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-white hover:text-brand-lime transition-colors duration-200 px-4 py-2"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="text-sm font-semibold text-brand-dark bg-gradient-to-r from-brand-lime to-brand-lime-dark px-5 py-2 rounded-full hover:opacity-90 transition-opacity duration-200"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-white p-2"
            aria-label="Toggle menu"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {mobileOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="8" x2="21" y2="8" />
                  <line x1="3" y1="16" x2="21" y2="16" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-brand-dark/95 backdrop-blur-md border-t border-neutral-800/50">
          <div className="px-4 py-4 space-y-3">
            {navLinks.map((link) =>
              link.href.startsWith('/') ? (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block text-sm text-neutral-300 hover:text-white transition-colors duration-200 py-2"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block text-sm text-neutral-300 hover:text-white transition-colors duration-200 py-2"
                >
                  {link.label}
                </a>
              )
            )}
            <div className="pt-3 border-t border-neutral-800 flex flex-col gap-3">
              <Link
                href="/login"
                className="text-sm text-white hover:text-brand-lime transition-colors duration-200 py-2"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="text-sm font-semibold text-brand-dark bg-gradient-to-r from-brand-lime to-brand-lime-dark px-5 py-2.5 rounded-full text-center hover:opacity-90 transition-opacity duration-200"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
