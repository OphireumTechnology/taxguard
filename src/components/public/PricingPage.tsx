import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ServicePlan } from '../../types';
import { 
  Check, 
  Sparkles, 
  HelpCircle, 
  CreditCard, 
  ShieldCheck, 
  ArrowRight, 
  Lock, 
  Clock, 
  CheckCircle2, 
  X,
  Plus
} from 'lucide-react';

export const PricingPage: React.FC = () => {
  const { servicePlans, setCurrentPage, currentUser, payInvoice } = useApp();
  const [billingCycle, setBillingCycle] = useState<'standard' | 'annual'>('standard');
  const [selectedPlan, setSelectedPlan] = useState<ServicePlan | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
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

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;

    setIsProcessing(true);
    // Simulate PCI compliant Stripe tokenization
    await new Promise(res => setTimeout(res, 1200));
    setIsProcessing(false);
    setCheckoutSuccess(true);
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
                    setCheckoutSuccess(false);
                  }}
                  className={`w-full py-3.5 rounded-xl text-xs font-bold transition-all shadow-md ${
                    plan.isPopular
                      ? 'bg-[#C6A15B] text-[#07172B] hover:bg-[#D9BF7A]'
                      : 'bg-[#07172B] text-slate-100 hover:text-white border border-[#1E3A5F] hover:border-[#C6A15B]'
                  }`}
                >
                  Select {plan.name}
                </button>
                <div className="text-center text-[10px] text-slate-400">
                  Secure checkout • Year-round portal included
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

      {/* Interactive Checkout Modal (Stripe Simulation) */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0D2340] border border-[#C6A15B]/50 rounded-2xl max-w-lg w-full p-6 sm:p-8 text-slate-100 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto">
            
            <button
              onClick={() => setSelectedPlan(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#132E52]"
            >
              <X className="w-5 h-5" />
            </button>

            {!checkoutSuccess ? (
              <form onSubmit={handleCheckoutSubmit} className="space-y-5">
                <div className="border-b border-[#1E3A5F] pb-3">
                  <div className="text-xs font-bold text-[#C6A15B] uppercase tracking-wider">
                    PCI-DSS Encrypted Checkout
                  </div>
                  <h3 className="font-serif text-2xl font-bold text-white mt-1">
                    {selectedPlan.name}
                  </h3>
                  <div className="text-xs text-slate-300 mt-1">
                    Total: <strong className="text-white text-base font-serif">${selectedPlan.price}</strong> 
                    {selectedPlan.billingPeriod === 'monthly' ? '/month' : ' one-time'}
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
                    <input 
                      type="text" 
                      defaultValue={currentUser?.name || 'Michael Perotti'}
                      required
                      className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Email for Receipt & Portal Access</label>
                    <input 
                      type="email" 
                      defaultValue={currentUser?.email || 'm.perotti@example.com'}
                      required
                      className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
                    />
                  </div>

                  <div className="pt-1">
                    <label className="block text-slate-300 font-semibold mb-1">Card Information (Stripe Sandbox Active)</label>
                    <div className="p-3 rounded-lg bg-[#07172B] border border-[#1E3A5F] flex items-center justify-between">
                      <div className="flex items-center gap-2 font-mono text-slate-300">
                        <CreditCard className="w-4 h-4 text-[#C6A15B]" />
                        <span>•••• •••• •••• 4242</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">12/28 • 888</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#07172B] border border-[#1E3A5F] flex items-center gap-2 text-[11px] text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-[#C6A15B] flex-shrink-0" />
                  <span>256-bit TLS encrypted transaction. Card numbers never touch client browser memory.</span>
                </div>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full py-3.5 rounded-xl font-bold text-xs text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                >
                  {isProcessing ? (
                    <span>Processing Payment...</span>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Complete Payment (${selectedPlan.price})
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="font-serif text-2xl font-bold text-white">Payment Confirmed!</h3>
                <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                  Thank you. Your transaction for <strong className="text-white">{selectedPlan.name}</strong> has been confirmed. 
                  An encrypted receipt and client portal activation instructions were sent to your email.
                </p>
                <div className="pt-2 flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setSelectedPlan(null);
                      setCurrentPage('client_portal');
                    }}
                    className="w-full py-3 rounded-xl font-bold text-xs text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A]"
                  >
                    Open Client Portal
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
