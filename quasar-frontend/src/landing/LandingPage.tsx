import { LandingNavbar } from './LandingNavbar';
import { HeroSection } from './HeroSection';
import { PhotoCarousel } from './PhotoCarousel';
import { FeaturesSection } from './FeaturesSection';
import { HowItWorksSection } from './HowItWorksSection';
import { CTASection } from './CTASection';
import { LandingFooter } from './LandingFooter';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080810] text-white overflow-x-hidden">
      <LandingNavbar />

      {/* Pre-carousel sections: relative z-10, with bottom margin to create the scroll gap */}
      <div className="relative" style={{ zIndex: 10, marginBottom: '100vh', background: '#080810' }}>
        <HeroSection />
        {/* Adds blank scrolling space before exposing the fixed carousel below */}
        <div style={{ height: '40vh' }} />
      </div>

      {/* PhotoCarousel: fixed behind everything, revealed as the above scrolls away */}
      <div className="fixed inset-0" style={{ zIndex: 0, background: '#080810' }}>
        <PhotoCarousel />
      </div>

      {/* Post-carousel sections: relative z-10, scroll up over the carousel */}
      <div className="relative" style={{ zIndex: 10, background: '#080810' }}>
        <FeaturesSection />
        <HowItWorksSection />
        <CTASection />
        <LandingFooter />
      </div>
    </div>
  );
}
