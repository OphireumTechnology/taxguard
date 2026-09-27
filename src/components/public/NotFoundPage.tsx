import React from 'react';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from '../common/BrandLogo';
import { Compass, Home, Phone, ArrowLeft, Lock } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const { setCurrentPage } = useApp();

  return (
    <div className="max-w-3xl mx-auto px-4 py-24 text-center space-y-8 text-slate-100">
      <div className="flex justify-center">
        <BrandLogo variant="emblem" size="lg" />
      </div>

      <div className="space-y-3">
        <span className="text-xs font-mono font-bold text-[#C6A15B] tracking-widest uppercase">
          Status Code 404 â€¢ Resource Not Located
        </span>
        <h1 className="font-serif text-4xl sm:text-5xl font-extrabold text-white">
          Page Not Found
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
          The requested URL or record is unavailable or may have been relocated within our encrypted portal hierarchy.
        </p>
      </div>

      <div className="pt-4 flex flex-wrap justify-center gap-4">
        <button
          onClick={() => setCurrentPage('home')}
          className="px-6 py-3 rounded-xl font-bold text-xs text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition-all flex items-center gap-2 shadow-lg"
        >
          <Home className="w-4 h-4" />
          Return to Homepage
        </button>

        <button
          onClick={() => window.location.hash = '#/client/login'}
          className="px-6 py-3 rounded-xl font-semibold text-xs text-white bg-[#0D2340] hover:bg-[#132E52] border border-[#1E3A5F] transition-all flex items-center gap-2"
        >
          <Lock className="w-4 h-4 text-[#C6A15B]" />
          Client Portal Login
        </button>

        <button
          onClick={() => setCurrentPage('contact')}
          className="px-6 py-3 rounded-xl font-semibold text-xs text-slate-300 hover:text-white border border-[#1E3A5F] transition-all flex items-center gap-2"
        >
          <Phone className="w-4 h-4 text-[#C6A15B]" />
          Contact Support (678-205-9486)
        </button>
      </div>
    </div>
  );
};


