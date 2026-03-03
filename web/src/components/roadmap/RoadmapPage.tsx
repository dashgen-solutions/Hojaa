'use client';

import MarketingNav from '@/components/marketing/MarketingNav';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import RoadmapHero from './RoadmapHero';
import RoadmapStats from './RoadmapStats';
import RoadmapBoard from './RoadmapBoard';
import FeatureRequests from './FeatureRequests';
import FeedbackSection from './FeedbackSection';

export default function RoadmapPage() {
  return (
    <div className="min-h-screen bg-brand-dark text-brand-light">
      <MarketingNav />
      <main className="overflow-x-hidden">
        <RoadmapHero />
        <RoadmapStats />
        <RoadmapBoard />
        <FeatureRequests />
        <FeedbackSection />
      </main>
      <MarketingFooter />
    </div>
  );
}
