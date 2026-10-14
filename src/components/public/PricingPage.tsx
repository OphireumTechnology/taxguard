import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ServicePlan } from '../../types';
import { PlanRequestDialog } from './PlanRequestDialog';
import { Check, Plus } from 'lucide-react';

export const PricingPage: React.FC = () => {
  const { servicePlans, setCurrentPage } = useApp();
  const [billingCycle, setBillingCycle] = useState<'standard' | 'annual'>('standard');
  const [selectedPlan, setSelectedPlan] = useState<ServicePlan | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  const addonsList = [
    { id: 'add_state', name: 'Additional State Tax Return Filing', price: 75, desc: 'For clients with multi-state W-2 or business revenue apportionment.' },
    { id: 'add_cleanup', name: 'Historical Bookkeeping Catch-Up (per month)', price: 150, desc: 'Complete reconciliation of past accounts and missing receipts.' },
    { id: 'add_audit', name: 'IRS Notice Review & Response Package', price: 250, desc: 'Professional review and structured response to IRS CP2000 or state notices.' },
  ];

  const toggleAddon = (id: string) => {
    setSelectedAddons(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-20 pb-20 text-slate-100">
      
      {/* Header Banner */}
      <section className="relative pt-12 pb-16 border-b border-[#1E3A5F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0D2340] border border-[#C6A15B]/40 text-[#C6A15B] text-xs font-semibold">
            <span>Transparent Investment</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl font-extrabold text-white">
            Pricing & Service Plans
          </h1>
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            No surprise billing, no hidden fees. Select a tailored package designed for your personal tax filing, corporate accounting, or family wealth stewardship.
          </p>
        </div>
      </section>

      {/* Main Pricing Cards Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white">
            Select Your Engagement Level
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto">
            Transparent fee structures tailored to personal preparation, small business bookkeeping, and ongoing advisory
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {servicePlans.map((plan) => (
            <div 
              key={plan.id}
              className={`p-8 rounded-3xl flex flex-col justify-between transition-all ${
                plan.isPopular 
                  ? 'bg-gradient-to-b from-[#0D2340] to-[#07172B] border-2 border-[#C6A15B] shadow-2xl relative' 
                  : 'bg-[#0D2340]/80 border border-[#1E3A5F]'
              }`}
            >
              {plan.isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#C6A15B] text-[#07172B] text-[11px] font-extrabold uppercase tracking-widest px-3 py-0.5 rounded-full shadow-md">
                  Most Popular
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <h3 className="font-serif text-2xl font-bold text-white">{plan.name}</h3>
                  <p className="text-xs text-[#C6A15B] mt-1 font-medium">{plan.tagline}</p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="font-serif text-4xl sm:text-5xl font-extrabold text-white">${plan.price}</span>
                  <span className="text-xs text-slate-400">
                    {plan.billingPeriod === 'monthly' ? '/ month' : ' one-time filing'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#07172B] border border-[#1E3A5F] text-xs text-slate-300">
                  <strong className="text-white block mb-0.5">Ideal for:</strong>
                  {plan.idealFor}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed border-t border-[#1E3A5F] pt-4">
                  {plan.description}
                </p>

                <div className="space-y-2.5 pt-2">
                  <div className="text-[11px] font-bold text-slate-200 uppercase tracking-wider">
                    Included Services:
                  </div>
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                      <Check className="w-3.5 h-3.5 text-[#C6A15B] flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-8 space-y-2">
                <button
                  onClick={() => {
                    setSelectedPlan(plan);
                  }}
                  className={`w-full py-3.5 rounded-xl text-xs font-bold transition-all shadow-md ${
                    plan.isPopular
                      ? 'bg-[#C6A15B] text-[#07172B] hover:bg-[#D9BF7A]'
                      : 'bg-[#07172B] text-slate-100 hover:text-white border border-[#1E3A5F] hover:border-[#C6A15B]'
                  }`}
                >
                  Request {plan.name}
                </button>
                <div className="text-center text-[10px] text-slate-400">
                  No online payment · arranged after a consultation
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Add-on Services Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 rounded-3xl bg-[#0D2340] border border-[#1E3A5F] space-y-6">
          <div className="border-b border-[#1E3A5F] pb-4">
            <span className="text-xs font-bold tracking-widest text-[#C6A15B] uppercase">Customization</span>
            <h2 className="font-serif text-2xl font-bold text-white mt-1">Available Add-On Services</h2>
            <p className="text-xs text-slate-300 mt-1">
              Add specific modular solutions to any base service plan.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {addonsList.map((addon) => (
              <div 
                key={addon.id} 
                onClick={() => toggleAddon(addon.id)}
                className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                  selectedAddons.includes(addon.id)
                    ? 'bg-[#07172B] border-[#C6A15B]'
                    : 'bg-[#07172B]/60 border-[#1E3A5F] hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-serif text-lg font-bold text-white">${addon.price}</span>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    selectedAddons.includes(addon.id) ? 'bg-[#C6A15B] text-[#07172B]' : 'bg-[#1E3A5F] text-slate-400'
                  }`}>
                    {selectedAddons.includes(addon.id) ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </div>
                </div>
                <h3 className="text-xs font-bold text-slate-100">{addon.name}</h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{addon.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Custom Engagement Card */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-[#07172B] to-[#0D2340] border border-[#C6A15B]/40 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-left">
            <span className="text-xs font-bold tracking-widest text-[#C6A15B] uppercase">Bespoke Advisory</span>
            <h2 className="font-serif text-2xl font-bold text-white">Need a Custom Multi-Entity Scope?</h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              For complex multi-state corporate structures, high-volume real estate syndications, or family office advisory, we provide customized engagement letters with dedicated staffing.
            </p>
          </div>
          <button
            onClick={() => setCurrentPage('book_consultation')}
            className="flex-shrink-0 px-6 py-3.5 rounded-xl font-bold text-xs text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition-all"
          >
            Request Custom Engagement
          </button>
        </div>
      </section>

      {/* Plan request: no payment is taken on this website. */}
      {selectedPlan && (
        <PlanRequestDialog plan={selectedPlan} onClose={() => setSelectedPlan(null)} onRequestConsultation={() => { setSelectedPlan(null); setCurrentPage('book_consultation'); }} />
      )}

    </div>
  );
};


