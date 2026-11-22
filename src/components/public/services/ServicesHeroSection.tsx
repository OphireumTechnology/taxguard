import React from 'react';
import { FileCheck2, Building2, Scale, CreditCard } from 'lucide-react';

export type ServiceCategoryId = 'individual' | 'business' | 'estate' | 'credit';

interface ServiceCategoryTab {
  id: ServiceCategoryId;
  label: string;
  countLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const SERVICE_CATEGORY_TABS: ServiceCategoryTab[] = [
  {
    id: 'individual',
    label: 'Individual Tax Services',
    countLabel: '6 Services',
    icon: FileCheck2,
  },
  {
    id: 'business',
    label: 'Business Tax & Bookkeeping',
    countLabel: '6 Services',
    icon: Building2,
  },
  {
    id: 'estate',
    label: 'Financial Protection & Estates',
    countLabel: '4 Services',
    icon: Scale,
  },
  {
    id: 'credit',
    label: 'Credit & Financial Solutions',
    countLabel: '3 Services',
    icon: CreditCard,
  },
];

interface ServicesHeroSectionProps {
  activeCategory: ServiceCategoryId;
  onSelectCategory: (category: ServiceCategoryId) => void;
  shouldAnimate: boolean;
}

/**
 * Immersive enterprise financial technology hero for the public Services page.
 * Perimeter SVG ledger pathways and subtle analytical waves stay outside the
 * calm dark-navy central focal zone so typography remains razor sharp.
 */
export const ServicesHeroSection: React.FC<ServicesHeroSectionProps> = ({
  activeCategory,
  onSelectCategory,
  shouldAnimate,
}) => {
  return (
    <section
      aria-labelledby="services-hero-heading"
      className="relative overflow-hidden border-b border-slate-700/50 bg-[#051527] pt-12 pb-14 sm:pt-16 sm:pb-18"
    >
      {/* Subtle Architectural Technology Grid & Controlled Ambient Illumination */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 64% 52% at 50% 42%, rgba(6, 24, 43, 0.92), rgba(6, 24, 43, 0.65) 68%, transparent 100%), radial-gradient(circle at 14% 24%, rgba(212, 168, 67, 0.11), transparent 40%), radial-gradient(circle at 86% 28%, rgba(56, 189, 248, 0.1), transparent 42%), linear-gradient(to right, rgba(148, 163, 184, 0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.045) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 100% 100%, 100% 100%, 56px 56px, 56px 56px',
        }}
        aria-hidden="true"
      />

      {/* Slowly Moving Perimeter Blockchain-Inspired Network & Analytics Layers */}
      <svg
        viewBox="0 0 1440 420"
        preserveAspectRatio="xMidYMid slice"
        className="pointer-events-none absolute inset-0 w-full h-full opacity-75"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="svc-hero-gold" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#D4A843" stopOpacity="0.08" />
            <stop offset="50%" stopColor="#E5B552" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#D4A843" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="svc-hero-cyan" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.06" />
            <stop offset="50%" stopColor="#7DD3FC" stopOpacity="0.58" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.06" />
          </linearGradient>
          <radialGradient id="svc-hero-veil" cx="50%" cy="44%" r="44%">
            <stop offset="0%" stopColor="#051527" stopOpacity="0.92" />
            <stop offset="68%" stopColor="#051527" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#051527" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Left-wing interconnected node pathways */}
        <g fill="none">
          <path
            d="M -20 92 L 156 92 L 228 148 L 360 148"
            stroke="rgba(148, 163, 184, 0.16)"
            strokeWidth="1"
          />
          <path
            d="M -20 92 L 156 92 L 228 148 L 360 148"
            stroke="url(#svc-hero-gold)"
            strokeWidth="1.25"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '7.5s' }}
          />
          <path
            d="M -20 310 L 182 310 L 254 252 L 398 252"
            stroke="rgba(148, 163, 184, 0.14)"
            strokeWidth="1"
          />
          <path
            d="M -20 310 L 182 310 L 254 252 L 398 252"
            stroke="url(#svc-hero-cyan)"
            strokeWidth="1.15"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '8.4s', animationDelay: '1.2s' }}
          />
          <path
            d="M 156 92 L 182 310"
            stroke="rgba(212, 168, 67, 0.2)"
            strokeWidth="0.85"
            strokeDasharray="3 7"
          />
        </g>

        {/* Right-wing interconnected node pathways */}
        <g fill="none">
          <path
            d="M 1460 96 L 1280 96 L 1208 152 L 1076 152"
            stroke="rgba(148, 163, 184, 0.16)"
            strokeWidth="1"
          />
          <path
            d="M 1460 96 L 1280 96 L 1208 152 L 1076 152"
            stroke="url(#svc-hero-gold)"
            strokeWidth="1.25"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '7.8s', animationDelay: '0.7s' }}
          />
          <path
            d="M 1460 314 L 1258 314 L 1184 256 L 1044 256"
            stroke="rgba(148, 163, 184, 0.14)"
            strokeWidth="1"
          />
          <path
            d="M 1460 314 L 1258 314 L 1184 256 L 1044 256"
            stroke="url(#svc-hero-cyan)"
            strokeWidth="1.15"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '8.6s', animationDelay: '1.8s' }}
          />
          <path
            d="M 1280 96 L 1258 314"
            stroke="rgba(125, 211, 252, 0.2)"
            strokeWidth="0.85"
            strokeDasharray="3 7"
          />
        </g>

        {/* Subtle lower financial analytics wave horizon */}
        <path
          d="M 0 384 Q 240 348 480 374 T 960 364 T 1440 380"
          fill="none"
          stroke="rgba(212, 168, 67, 0.22)"
          strokeWidth="1.1"
        />

        {/* Perimeter illuminated digital ledger nodes */}
        {[
          { cx: 156, cy: 92, color: '#E5B552', delay: '0s' },
          { cx: 228, cy: 148, color: '#7DD3FC', delay: '0.8s' },
          { cx: 182, cy: 310, color: '#7DD3FC', delay: '1.5s' },
          { cx: 254, cy: 252, color: '#E5B552', delay: '2.1s' },
          { cx: 1280, cy: 96, color: '#E5B552', delay: '0.5s' },
          { cx: 1208, cy: 152, color: '#7DD3FC', delay: '1.2s' },
          { cx: 1258, cy: 314, color: '#7DD3FC', delay: '1.9s' },
          { cx: 1184, cy: 256, color: '#E5B552', delay: '2.4s' },
        ].map((node, idx) => (
          <g key={idx}>
            <polygon
              points={`${node.cx},${node.cy - 9} ${node.cx + 8},${node.cy - 4.5} ${node.cx + 8},${node.cy + 4.5} ${node.cx},${node.cy + 9} ${node.cx - 8},${node.cy + 4.5} ${node.cx - 8},${node.cy - 4.5}`}
              fill="rgba(6, 24, 43, 0.85)"
              stroke={node.color}
              strokeOpacity="0.45"
              strokeWidth="0.9"
            />
            <circle
              cx={node.cx}
              cy={node.cy}
              r="2.4"
              fill={node.color}
              className="destria-checkpoint-glow"
              style={{ animationDelay: node.delay }}
            />
          </g>
        ))}

        {/* Moving data particles along perimeter pathways */}
        {shouldAnimate && (
          <>
            <circle r="2.8" fill="#F3CE74" opacity="0.92">
              <animateMotion
                dur="8.2s"
                repeatCount="indefinite"
                path="M -20 92 L 156 92 L 228 148 L 360 148"
              />
            </circle>
            <circle r="2.4" fill="#7DD3FC" opacity="0.86">
              <animateMotion
                dur="9.4s"
                begin="1.6s"
                repeatCount="indefinite"
                path="M -20 310 L 182 310 L 254 252 L 398 252"
              />
            </circle>
            <circle r="2.8" fill="#F3CE74" opacity="0.92">
              <animateMotion
                dur="8.5s"
                begin="0.9s"
                repeatCount="indefinite"
                path="M 1460 96 L 1280 96 L 1208 152 L 1076 152"
              />
            </circle>
            <circle r="2.4" fill="#7DD3FC" opacity="0.86">
              <animateMotion
                dur="9.6s"
                begin="2.3s"
                repeatCount="indefinite"
                path="M 1460 314 L 1258 314 L 1184 256 L 1044 256"
              />
            </circle>
          </>
        )}

        {/* Calm center focal veil keeping typography completely unobstructed */}
        <ellipse cx="720" cy="186" rx="540" ry="185" fill="url(#svc-hero-veil)" />
      </svg>

      {/* Main Centered Hero Content */}
      <div className="relative z-10 max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-10 text-center space-y-5">
        <p className="text-xs font-semibold tracking-[0.18em] text-[#E5B552] uppercase">
          Boutique Accounting &amp; Tax Solutions · Destria Financial Technology
        </p>

        <h1
          id="services-hero-heading"
          className="font-serif text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-white tracking-tight leading-[1.1] [text-wrap:balance]"
        >
          Our Comprehensive Services
        </h1>

        <p className="text-base sm:text-lg text-[#A9B7C8] max-w-2xl mx-auto leading-relaxed">
          From individual tax preparation to complex multi-tier business accounting and legacy coordination. Meticulous, client-centered, and compliant.
        </p>

        {/* Four Enhanced Service Category Selection Buttons */}
        <div
          role="tablist"
          aria-label="Service categories"
          className="pt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-5xl mx-auto"
        >
          {SERVICE_CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => onSelectCategory(tab.id)}
                className={`group relative rounded-xl px-4 py-3.5 text-left border transition-all duration-200 flex items-center gap-3 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5B552] ${
                  isSelected
                    ? 'bg-[#D4A843] text-[#06182B] border-[#E5B552] shadow-[0_14px_34px_-14px_rgba(212,168,67,0.6)]'
                    : 'bg-[#081D34]/90 backdrop-blur-md text-slate-200 border-slate-700/70 hover:border-[#D4A843]/65 hover:bg-[#0D2745]'
                }`}
              >
                {/* Top metallic border illumination on hover */}
                {!isSelected && (
                  <span
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E5B552]/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    aria-hidden="true"
                  />
                )}

                <span
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
                    isSelected
                      ? 'bg-[#06182B]/15 border-[#06182B]/25 text-[#06182B]'
                      : 'bg-[#06182B]/90 border-slate-700/80 text-[#E5B552] group-hover:border-[#D4A843]/55'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </span>

                <span className="min-w-0">
                  <span
                    className={`block text-xs sm:text-[13px] font-bold leading-snug truncate ${
                      isSelected ? 'text-[#06182B]' : 'text-white'
                    }`}
                  >
                    {tab.label}
                  </span>
                  <span
                    className={`block text-[11px] font-medium mt-0.5 ${
                      isSelected ? 'text-[#06182B]/80' : 'text-[#A9B7C8]'
                    }`}
                  >
                    {tab.countLabel}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
