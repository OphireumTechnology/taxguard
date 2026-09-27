import React from 'react';
import { TopUtilityBar } from '../common/TopUtilityBar';
import { Navbar } from '../common/Navbar';
import { Footer } from '../common/Footer';
import { CookiePreferencesModal } from '../common/CookiePreferencesModal';
import { SEOHead } from '../common/SEOHead';

interface PublicLayoutProps {
  children: React.ReactNode;
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-[#06172C] text-[#F8F6F1] font-sans selection:bg-[#C99A3D] selection:text-[#06172C]">
      {/* Dynamic SEO & Metadata Management */}
      <SEOHead />

      {/* Skip to content accessible anchor for WCAG 2.1 AA keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-[#C99A3D] focus:text-[#06172C] focus:font-bold focus:text-xs focus:uppercase focus:tracking-wider focus:rounded-lg focus:shadow-2xl focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>

      {/* Unified Responsive Public Header */}
      <header className="sticky top-0 z-40 w-full bg-[#06172C] shadow-md">
        <TopUtilityBar />
        <Navbar />
      </header>

      {/* Main Marketing Viewport */}
      <main className="flex-1 min-w-0" id="main-content" tabIndex={-1}>
        {children}
      </main>

      {/* Comprehensive Public Marketing Footer */}
      <Footer />

      {/* Cookie & Data Privacy Customizer */}
      <CookiePreferencesModal />
    </div>
  );
};
