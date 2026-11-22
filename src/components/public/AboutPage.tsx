import React, { useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useInViewMotion } from './home/useInViewMotion';
import { AboutHeroSection } from './about/AboutHeroSection';
import { MissionVisionShowcase } from './about/MissionVisionShowcase';
import { ExecutiveLeadershipShowcase } from './about/ExecutiveLeadershipShowcase';
import { TrustTransparencyNetwork } from './about/TrustTransparencyNetwork';
import { CoreValuesShowcase } from './about/CoreValuesShowcase';
import { CommunityAndPartnershipsShowcase } from './about/CommunityAndPartnershipsShowcase';

export const AboutPage: React.FC = () => {
  const { setCurrentPage } = useApp();

  const heroRef = useRef<HTMLDivElement | null>(null);
  const missionRef = useRef<HTMLDivElement | null>(null);
  const leadershipRef = useRef<HTMLDivElement | null>(null);
  const networkRef = useRef<HTMLDivElement | null>(null);
  const valuesRef = useRef<HTMLDivElement | null>(null);
  const communityRef = useRef<HTMLDivElement | null>(null);

  const { shouldAnimate: heroAnimate } = useInViewMotion(heroRef);
  const { shouldAnimate: missionAnimate } = useInViewMotion(missionRef);
  const { shouldAnimate: leadershipAnimate } = useInViewMotion(leadershipRef);
  const { shouldAnimate: networkAnimate } = useInViewMotion(networkRef);
  const { shouldAnimate: valuesAnimate } = useInViewMotion(valuesRef);
  const { shouldAnimate: communityAnimate } = useInViewMotion(communityRef);

  return (
    <div className="space-y-16 sm:space-y-20 lg:space-y-24 pb-24 text-slate-100 overflow-x-clip">
      <div ref={heroRef}>
        <AboutHeroSection
          onMeetFounder={() => setCurrentPage('founder')}
          onExploreServices={() => setCurrentPage('services')}
          shouldAnimate={heroAnimate}
        />
      </div>

      <div ref={missionRef}>
        <MissionVisionShowcase shouldAnimate={missionAnimate} />
      </div>

      <div ref={leadershipRef}>
        <ExecutiveLeadershipShowcase
          onViewProfile={() => setCurrentPage('founder')}
          onScheduleConsultation={() => setCurrentPage('book_consultation')}
          shouldAnimate={leadershipAnimate}
        />
      </div>

      <div ref={networkRef}>
        <TrustTransparencyNetwork shouldAnimate={networkAnimate} />
      </div>

      <div ref={valuesRef}>
        <CoreValuesShowcase shouldAnimate={valuesAnimate} />
      </div>

      <div ref={communityRef}>
        <CommunityAndPartnershipsShowcase
          onInquirePartnerships={() => setCurrentPage('contact')}
          shouldAnimate={communityAnimate}
        />
      </div>
    </div>
  );
};
