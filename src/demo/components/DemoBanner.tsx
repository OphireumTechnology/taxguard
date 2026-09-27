import React from 'react';
import { AlertCircle } from 'lucide-react';

interface DemoBannerProps {
  variant?: 'light' | 'navy';
}

export const DemoBanner: React.FC<DemoBannerProps> = ({ variant = 'navy' }) => {
  const isNavy = variant === 'navy';

  return (
    <div 
      className={`w-full py-2 px-4 text-center text-xs font-semibold tracking-wide flex items-center justify-center gap-2 transition-colors ${
        isNavy 
          ? 'bg-[#040E1B] border-b border-[#1E3A5F] text-slate-300' 
          : 'bg-white border-b border-neutral-300 text-black'
      }`}
      role="banner"
      aria-label="Demonstration Environment Notice"
    >
      <AlertCircle className={`w-3.5 h-3.5 flex-shrink-0 ${isNavy ? 'text-[#C99A32]' : 'text-black'}`} />
      <span>
        DEMONSTRATION ENVIRONMENT — No live tax filing, payment, signature, banking connection, accounting synchronization, or government submission is currently performed.
      </span>
    </div>
  );
};
