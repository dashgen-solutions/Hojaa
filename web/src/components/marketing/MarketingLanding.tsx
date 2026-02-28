'use client';

import MarketingNav from './MarketingNav';
import Hero from './Hero';
import Seesaw from './Seesaw';
import Features from './Features';
import HowItWorks from './HowItWorks';
import OpenSource from './OpenSource';
import Pricing from './Pricing';
import MarketingFooter from './MarketingFooter';

export default function MarketingLanding() {
  return (
    <div className="min-h-screen bg-brand-dark text-brand-light">
      <MarketingNav />
      <main className="overflow-x-hidden">
        <Hero />
        <Seesaw />
        <Features />
        <HowItWorks />
        <OpenSource />
        <Pricing />
      </main>
      <MarketingFooter />
    </div>
  );
}
