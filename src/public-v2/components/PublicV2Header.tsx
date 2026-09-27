import React, { useState, useEffect } from 'react';
import { PublicV2Logo } from './PublicV2Logo';
import { Menu, X, ArrowUpRight, MessageSquareCode } from 'lucide-react';

interface PublicV2HeaderProps {
  activePath: string;
  onNavigate: (path: string) => void;
  onOpenConsultation: () => void;
}

export const PublicV2Header: React.FC<PublicV2HeaderProps> = ({
  activePath,
  onNavigate,
  onOpenConsultation
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const navLinks = [
    { label: 'Home', path: '/public-v2' },
    { label: 'About', path: '/public-v2/about' },
    { label: 'Services', path: '/public-v2/services' },
    { label: 'Industries', path: '/public-v2/industries' },
    { label: 'Resources', path: '/public-v2/resources' },
    { 
      label: 'Accounting Assistant', 
      path: '/public-v2/accounting-assistant',
      isAssistant: true 
    },
    { label: 'Contact', path: '/public-v2/contact' },
    { label: 'Client & Staff Portals', path: '/public-v2/portals' }
  ];

  const handleLinkClick = (path: string) => {
    onNavigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-black text-black">
      {/* Demonstration notice strip */}
      <div className="bg-black text-white text-[11px] font-mono py-1 px-4 text-center tracking-tight flex items-center justify-between sm:justify-center">
        <span>Public Page 2 Preview — Alternative Minimalist Site for Demonstration</span>
        <button
          onClick={() => onNavigate('/')}
          className="underline hover:text-neutral-300 ml-4 text-[10px] hidden sm:inline-block"
        >
          Return to Primary Site
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Brand Logo & Name */}
          <PublicV2Logo 
            size="md" 
            onClick={() => handleLinkClick('/public-v2')} 
          />

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-5 text-xs font-medium" aria-label="Main Navigation">
            {navLinks.map((item) => {
              const isActive = activePath === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => handleLinkClick(item.path)}
                  className={`transition-colors py-1 cursor-pointer whitespace-nowrap focus:outline-none focus-visible:ring-1 focus-visible:ring-black ${
                    item.isAssistant 
                      ? 'inline-flex items-center gap-1 font-semibold px-2 py-0.5 border border-black bg-neutral-50 hover:bg-black hover:text-white'
                      : isActive 
                        ? 'text-black font-bold border-b-2 border-black' 
                        : 'text-neutral-600 hover:text-black'
                  }`}
                >
                  {item.isAssistant && <MessageSquareCode className="w-3.5 h-3.5" />}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* CTA & Mobile Menu Toggle */}
          <div className="flex items-center space-x-3">
            <button
              onClick={onOpenConsultation}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-black text-white text-xs font-medium hover:bg-neutral-800 transition-colors cursor-pointer border border-black"
            >
              <span>Book Consultation</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-black border border-neutral-300 hover:border-black focus:outline-none focus-visible:ring-1 focus-visible:ring-black"
              aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-black" /> : <Menu className="w-5 h-5 text-black" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Slide-down Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-[89px] bottom-0 bg-white z-50 border-t border-black overflow-y-auto p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-neutral-200 pb-3">
              <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-widest">Navigation Menu</span>
            </div>
            <nav className="flex flex-col space-y-3" aria-label="Mobile Navigation">
              {navLinks.map((item) => {
                const isActive = activePath === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => handleLinkClick(item.path)}
                    className={`text-left py-2 px-3 text-sm font-medium border-l-2 transition-all flex items-center justify-between ${
                      item.isAssistant 
                        ? 'border-black bg-neutral-100 font-bold'
                        : isActive 
                          ? 'border-black bg-neutral-50 font-bold text-black' 
                          : 'border-transparent text-neutral-700 hover:text-black hover:border-neutral-400'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {item.isAssistant && <MessageSquareCode className="w-4 h-4 text-black" />}
                      {item.label}
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-neutral-400" />
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="pt-6 border-t border-neutral-200 space-y-3">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenConsultation();
              }}
              className="w-full py-3 bg-black text-white text-center text-sm font-medium hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2"
            >
              <span>Book Consultation</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleLinkClick('/')}
              className="w-full py-2.5 bg-white text-black border border-black text-center text-xs font-medium hover:bg-neutral-100 transition-colors"
            >
              Return to Primary Public Website
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
