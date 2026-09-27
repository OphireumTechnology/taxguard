import React, { useState, useEffect, useRef } from 'react';
import { useApp, PageRoute } from '../../context/AppContext';
import { BrandLogo } from './BrandLogo';
import { 
  Phone, 
  Calendar, 
  Menu, 
  X, 
  ChevronDown, 
  Lock, 
  LayoutDashboard, 
  Briefcase, 
  ShieldAlert,
  User as UserIcon,
  HelpCircle,
  Sparkles,
  FileSpreadsheet,
  Building2,
  Scale,
  CreditCard,
  Layers,
  ArrowRight,
  HardHat,
  Stethoscope,
  Truck,
  Laptop,
  Utensils,
  HeartHandshake,
  DollarSign,
  FileCheck
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { currentPage, setCurrentPage, currentRole, currentUser } = useApp();
  
  // Desktop dropdown states
  const [servicesOpen, setServicesOpen] = useState(false);
  const [industriesOpen, setIndustriesOpen] = useState(false);
  const [taxStrategiesOpen, setTaxStrategiesOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Mobile drawer states
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const [mobileIndustriesOpen, setMobileIndustriesOpen] = useState(false);
  const [mobileStrategiesOpen, setMobileStrategiesOpen] = useState(false);

  // Refs for click-outside and focus management
  const servicesRef = useRef<HTMLDivElement>(null);
  const industriesRef = useRef<HTMLDivElement>(null);
  const taxStrategiesRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);

  const servicesBtnRef = useRef<HTMLButtonElement>(null);
  const industriesBtnRef = useRef<HTMLButtonElement>(null);
  const taxStrategiesBtnRef = useRef<HTMLButtonElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const hamburgerBtnRef = useRef<HTMLButtonElement>(null);

  const closeAllDropdowns = () => {
    setServicesOpen(false);
    setIndustriesOpen(false);
    setTaxStrategiesOpen(false);
    setMoreOpen(false);
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        servicesRef.current && !servicesRef.current.contains(target) &&
        industriesRef.current && !industriesRef.current.contains(target) &&
        taxStrategiesRef.current && !taxStrategiesRef.current.contains(target) &&
        moreRef.current && !moreRef.current.contains(target)
      ) {
        closeAllDropdowns();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdowns and drawer on Escape key with focus restoration
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (servicesOpen) {
          setServicesOpen(false);
          servicesBtnRef.current?.focus();
        } else if (industriesOpen) {
          setIndustriesOpen(false);
          industriesBtnRef.current?.focus();
        } else if (taxStrategiesOpen) {
          setTaxStrategiesOpen(false);
          taxStrategiesBtnRef.current?.focus();
        } else if (moreOpen) {
          setMoreOpen(false);
          moreBtnRef.current?.focus();
        } else if (mobileMenuOpen) {
          setMobileMenuOpen(false);
          hamburgerBtnRef.current?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [servicesOpen, industriesOpen, taxStrategiesOpen, moreOpen, mobileMenuOpen]);

  // Lock background scroll when mobile menu is open
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

  const handleNavClick = (page: PageRoute) => {
    setCurrentPage(page);
    closeAllDropdowns();
    setMobileMenuOpen(false);
  };

  const handlePortalAction = () => {
    if (currentUser && currentRole !== 'guest') {
      if (currentRole === 'client') {
        window.location.hash = '#/client/login';
      } else if (currentRole === 'accountant') {
        window.location.hash = '#/accountant/dashboard';
      } else if (currentRole === 'senior_reviewer') {
        window.location.hash = '#/reviewer/dashboard';
      } else if (currentRole === 'admin' || currentRole === 'super_admin') {
        window.location.hash = '#/admin/dashboard';
      } else {
        window.location.hash = '#/client/login';
      }
    } else {
      window.location.hash = '#/client/login';
    }
    setMobileMenuOpen(false);
  };

  const getPortalButtonLabel = () => {
    return 'Client Portal';
  };

  const isMoreActive = ['pricing', 'resources', 'careers', 'contact', 'founder', 'industries'].includes(currentPage);

  return (
    <div className="w-full bg-[#06172C]/95 backdrop-blur-md border-b border-[#0B2748] relative z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 xl:px-8">
        <div className="flex items-center justify-between h-20 gap-2 lg:gap-3 xl:gap-6 min-w-0">
          
          {/* BRAND LOGO AREA */}
          <div className="flex-shrink-0 min-w-0 py-2">
            <BrandLogo 
              size="md" 
              hideTaglineOnCompact={true}
              onClick={() => handleNavClick('home')} 
            />
          </div>

          {/* DESKTOP PRIMARY NAVIGATION (1024px+) */}
          {/* Clean architecture: Home, About, Services â–¼, Industries â–¼ (xl), Tax Strategies â–¼, More â–¼ */}
          <nav 
            className="hidden lg:flex items-center gap-0.5 xl:gap-1.5 flex-shrink-0"
            aria-label="Primary Site Navigation"
          >
            {/* 1. Home */}
            <button
              type="button"
              onClick={() => handleNavClick('home')}
              className={`text-xs font-medium tracking-wider uppercase transition-colors whitespace-nowrap px-2 xl:px-2.5 py-2 rounded-md hover:bg-[#0B2748]/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C99A3D] ${
                currentPage === 'home' 
                  ? 'text-[#E2BD67] font-semibold' 
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Home
            </button>

            {/* 2. About */}
            <button
              type="button"
              onClick={() => handleNavClick('about')}
              className={`text-xs font-medium tracking-wider uppercase transition-colors whitespace-nowrap px-2 xl:px-2.5 py-2 rounded-md hover:bg-[#0B2748]/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C99A3D] ${
                currentPage === 'about' 
                  ? 'text-[#E2BD67] font-semibold' 
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              About
            </button>

            {/* 3. Services â–¼ */}
            <div className="relative" ref={servicesRef}>
              <button
                ref={servicesBtnRef}
                type="button"
                onClick={() => {
                  setServicesOpen(!servicesOpen);
                  setIndustriesOpen(false);
                  setTaxStrategiesOpen(false);
                  setMoreOpen(false);
                }}
                aria-expanded={servicesOpen}
                aria-haspopup="true"
                className={`text-xs font-medium tracking-wider uppercase flex items-center gap-1 transition-colors whitespace-nowrap px-2 xl:px-2.5 py-2 rounded-md hover:bg-[#0B2748]/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C99A3D] ${
                  currentPage === 'services' 
                    ? 'text-[#E2BD67] font-semibold' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <span>Services</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${servicesOpen ? 'rotate-180 text-[#E2BD67]' : 'text-slate-400'}`} />
              </button>

              {servicesOpen && (
                <div 
                  role="menu"
                  className="absolute left-0 mt-2 w-80 rounded-xl bg-[#0B2748] border border-[#1E3A5F] shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 text-slate-100"
                >
                  <button
                    role="menuitem"
                    onClick={() => handleNavClick('services')}
                    className="w-full text-left p-2.5 rounded-lg hover:bg-[#132E52] transition-colors group flex items-start gap-3"
                  >
                    <div className="p-1.5 rounded-md bg-[#06172C] text-[#C99A3D] border border-[#0B2748] group-hover:border-[#C99A3D]/50 transition-colors mt-0.5">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-100 group-hover:text-[#E2BD67] transition-colors">
                        All Comprehensive Services
                      </div>
                      <div className="text-[11px] text-slate-400">Complete overview of personal &amp; business advisory</div>
                    </div>
                  </button>

                  <div className="h-px bg-[#1E3A5F]/70 my-1" />

                  <button
                    role="menuitem"
                    onClick={() => handleNavClick('services')}
                    className="w-full text-left p-2 rounded-lg hover:bg-[#132E52] transition-colors flex items-start gap-2.5"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-[#C99A3D] mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-medium text-slate-200 hover:text-white">Individual Tax Filings</div>
                      <div className="text-[10px] text-slate-400">Form 1040, W-2, 1099 &amp; Itemized Deductions</div>
                    </div>
                  </button>

                  <button
                    role="menuitem"
                    onClick={() => handleNavClick('services')}
                    className="w-full text-left p-2 rounded-lg hover:bg-[#132E52] transition-colors flex items-start gap-2.5"
                  >
                    <Building2 className="w-3.5 h-3.5 text-[#C99A3D] mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-medium text-slate-200 hover:text-white">Business Tax &amp; Bookkeeping</div>
                      <div className="text-[10px] text-slate-400">LLC, S-Corp, Form 1120-S &amp; QBO Reconciliations</div>
                    </div>
                  </button>

                  <button
                    role="menuitem"
                    onClick={() => handleNavClick('services')}
                    className="w-full text-left p-2 rounded-lg hover:bg-[#132E52] transition-colors flex items-start gap-2.5"
                  >
                    <Scale className="w-3.5 h-3.5 text-[#C99A3D] mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-medium text-slate-200 hover:text-white">Financial Protection &amp; Estates</div>
                      <div className="text-[10px] text-slate-400">Living Wills, Trusts &amp; Legal Coordination</div>
                    </div>
                  </button>

                  <button
                    role="menuitem"
                    onClick={() => handleNavClick('services')}
                    className="w-full text-left p-2 rounded-lg hover:bg-[#132E52] transition-colors flex items-start gap-2.5"
                  >
                    <CreditCard className="w-3.5 h-3.5 text-[#C99A3D] mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-medium text-slate-200 hover:text-white">Credit &amp; Financial Solutions</div>
                      <div className="text-[10px] text-slate-400">Restoration, Identity Shield &amp; Consulting</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* 4. Industries â–¼ (Visible on xl, accessible via More on lg) */}
            <div className="hidden xl:block relative" ref={industriesRef}>
              <button
                ref={industriesBtnRef}
                type="button"
                onClick={() => {
                  setIndustriesOpen(!industriesOpen);
                  setServicesOpen(false);
                  setTaxStrategiesOpen(false);
                  setMoreOpen(false);
                }}
                aria-expanded={industriesOpen}
                aria-haspopup="true"
                className={`text-xs font-medium tracking-wider uppercase flex items-center gap-1 transition-colors whitespace-nowrap px-2 xl:px-2.5 py-2 rounded-md hover:bg-[#0B2748]/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C99A3D] ${
                  currentPage === 'industries' 
                    ? 'text-[#E2BD67] font-semibold' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <span>Industries</span>
                <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${industriesOpen ? 'rotate-180 text-[#E2BD67]' : 'text-slate-400'}`} />
              </button>

              {industriesOpen && (
                <div 
                  role="menu"
                  className="absolute left-0 mt-2 w-80 rounded-xl bg-[#0B2748] border border-[#1E3A5F] shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 text-slate-100"
                >
                  <button
                    role="menuitem"
                    onClick={() => handleNavClick('industries')}
                    className="w-full text-left p-2.5 rounded-lg hover:bg-[#132E52] transition-colors group flex items-start gap-3"
                  >
                    <div className="p-1.5 rounded-md bg-[#06172C] text-[#C99A3D] border border-[#0B2748] group-hover:border-[#C99A3D]/50 transition-colors mt-0.5">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-100 group-hover:text-[#E2BD67] transition-colors">
                        Specialized Practice Sectors
                      </div>
                      <div className="text-[11px] text-slate-400">8 tailored commercial frameworks</div>
                    </div>
                  </button>

                  <div className="h-px bg-[#1E3A5F]/70 my-1" />

                  <div className="grid grid-cols-1 gap-0.5">
                    {[
                      { name: 'Construction & Contractors', icon: HardHat },
                      { name: 'Real Estate Investors & Syndications', icon: Building2 },
                      { name: 'Healthcare & Medical Practices', icon: Stethoscope },
                      { name: 'Legal & Professional Services', icon: Scale },
                      { name: 'Transportation & Logistics', icon: Truck },
                      { name: 'Technology & E-commerce', icon: Laptop },
                      { name: 'Restaurants & Hospitality', icon: Utensils },
                      { name: 'Nonprofits & Foundations', icon: HeartHandshake }
                    ].map((sec, idx) => {
                      const IconComp = sec.icon;
                      return (
                        <button
                          key={idx}
                          role="menuitem"
                          onClick={() => handleNavClick('industries')}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#132E52] transition-colors flex items-center gap-2 text-xs text-slate-200 hover:text-[#E2BD67]"
                        >
                          <IconComp className="w-3.5 h-3.5 text-[#C99A3D] flex-shrink-0" />
                          <span className="truncate">{sec.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 5. Tax Strategies â–¼ */}
            <div className="relative" ref={taxStrategiesRef}>
              <button
                ref={taxStrategiesBtnRef}
                type="button"
                onClick={() => {
                  setTaxStrategiesOpen(!taxStrategiesOpen);
                  setServicesOpen(false);
                  setIndustriesOpen(false);
                  setMoreOpen(false);
                }}
                aria-expanded={taxStrategiesOpen}
                aria-haspopup="true"
                className={`text-xs font-medium tracking-wider uppercase flex items-center gap-1 transition-colors whitespace-nowrap px-1.5 xl:px-2.5 py-2 rounded-md hover:bg-[#0B2748]/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C99A3D] ${
                  currentPage === 'tax_strategies' 
                    ? 'text-[#E2BD67] font-semibold' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <span>
                  <span className="hidden xl:inline">Tax </span>Strategies
                </span>
                <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${taxStrategiesOpen ? 'rotate-180 text-[#E2BD67]' : 'text-slate-400'}`} />
              </button>

              {taxStrategiesOpen && (
                <div 
                  role="menu"
                  className="absolute left-0 mt-2 w-80 rounded-xl bg-[#0B2748] border border-[#1E3A5F] shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 text-slate-100"
                >
                  <button
                    role="menuitem"
                    onClick={() => handleNavClick('tax_strategies')}
                    className="w-full text-left p-2.5 rounded-lg hover:bg-[#132E52] transition-colors group flex items-start gap-3"
                  >
                    <div className="p-1.5 rounded-md bg-[#06172C] text-[#C99A3D] border border-[#0B2748] group-hover:border-[#C99A3D]/50 transition-colors mt-0.5">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-100 group-hover:text-[#E2BD67] transition-colors">
                        Tax Strategies Catalog
                      </div>
                      <div className="text-[11px] text-slate-400">16 strategic tax reduction domains</div>
                    </div>
                  </button>

                  <div className="h-px bg-[#1E3A5F]/70 my-1" />

                  <button
                    role="menuitem"
                    onClick={() => handleNavClick('tax_strategies')}
                    className="w-full text-left p-2 rounded-lg hover:bg-[#132E52] transition-colors flex items-start gap-2.5"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-[#C99A3D] mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-medium text-slate-200">High-Net-Worth &amp; Executives</div>
                      <div className="text-[10px] text-slate-400">Alternative Minimum Tax, stock options &amp; trusts</div>
                    </div>
                  </button>

                  <button
                    role="menuitem"
                    onClick={() => handleNavClick('tax_strategies')}
                    className="w-full text-left p-2 rounded-lg hover:bg-[#132E52] transition-colors flex items-start gap-2.5"
                  >
                    <Building2 className="w-3.5 h-3.5 text-[#C99A3D] mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-medium text-slate-200">Small Business Pass-Throughs</div>
                      <div className="text-[10px] text-slate-400">Section 199A QBI, reasonable salary &amp; deductions</div>
                    </div>
                  </button>

                  <button
                    role="menuitem"
                    onClick={() => handleNavClick('tax_strategies')}
                    className="w-full text-left p-2 rounded-lg hover:bg-[#132E52] transition-colors flex items-start gap-2.5"
                  >
                    <FileCheck className="w-3.5 h-3.5 text-[#C99A3D] mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-medium text-slate-200">Real Estate &amp; Capital Assets</div>
                      <div className="text-[10px] text-slate-400">Cost segregation, 1031 exchanges &amp; depreciation</div>
                    </div>
                  </button>

                  <button
                    role="menuitem"
                    onClick={() => handleNavClick('tax_strategies')}
                    className="w-full text-left p-2 rounded-lg hover:bg-[#132E52] transition-colors flex items-start gap-2.5"
                  >
                    <Scale className="w-3.5 h-3.5 text-[#C99A3D] mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-medium text-slate-200">Retirement &amp; Succession</div>
                      <div className="text-[10px] text-slate-400">Defined benefit plans &amp; wealth preservation</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* 6. More â–¼ */}
            <div className="relative" ref={moreRef}>
              <button
                ref={moreBtnRef}
                type="button"
                onClick={() => {
                  setMoreOpen(!moreOpen);
                  setServicesOpen(false);
                  setIndustriesOpen(false);
                  setTaxStrategiesOpen(false);
                }}
                aria-expanded={moreOpen}
                aria-haspopup="true"
                className={`text-xs font-medium tracking-wider uppercase flex items-center gap-1 transition-colors whitespace-nowrap px-2 xl:px-2.5 py-2 rounded-md hover:bg-[#0B2748]/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C99A3D] ${
                  isMoreActive 
                    ? 'text-[#E2BD67] font-semibold' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <span>More</span>
                <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${moreOpen ? 'rotate-180 text-[#E2BD67]' : 'text-slate-400'}`} />
              </button>

              {moreOpen && (
                <div 
                  role="menu"
                  className="absolute right-0 mt-2 w-72 rounded-xl bg-[#0B2748] border border-[#1E3A5F] shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 text-slate-100"
                >
                  {/* Shown in More only on lg screens where Industries is not in top bar */}
                  <div className="xl:hidden">
                    <button
                      role="menuitem"
                      onClick={() => handleNavClick('industries')}
                      className={`w-full text-left p-2.5 rounded-lg hover:bg-[#132E52] transition-colors flex items-start gap-2.5 ${currentPage === 'industries' ? 'bg-[#132E52]' : ''}`}
                    >
                      <Layers className="w-4 h-4 text-[#C99A3D] mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-slate-100">Industries &amp; Sectors</div>
                        <div className="text-[11px] text-slate-400">8 specialized commercial practice areas</div>
                      </div>
                    </button>

                    <div className="h-px bg-[#1E3A5F]/70 my-1" />
                  </div>

                  <button
                    role="menuitem"
                    onClick={() => handleNavClick('resources')}
                    className={`w-full text-left p-2.5 rounded-lg hover:bg-[#132E52] transition-colors flex items-start gap-2.5 ${currentPage === 'resources' ? 'bg-[#132E52]' : ''}`}
                  >
                    <HelpCircle className="w-4 h-4 text-[#C99A3D] mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-slate-100">Resources &amp; FAQ</div>
                      <div className="text-[11px] text-slate-400">Tax Deadlines, Checklists &amp; Guides</div>
                    </div>
                  </button>

                  <button
                    role="menuitem"
                    onClick={() => handleNavClick('contact')}
                    className={`w-full text-left p-2.5 rounded-lg hover:bg-[#132E52] transition-colors flex items-start gap-2.5 ${currentPage === 'contact' ? 'bg-[#132E52]' : ''}`}
                  >
                    <Building2 className="w-4 h-4 text-[#C99A3D] mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-slate-100">Contact Us</div>
                      <div className="text-[11px] text-slate-400">Columbia, SC Office &amp; Inquiries</div>
                    </div>
                  </button>

                  <div className="h-px bg-[#1E3A5F]/70 my-1" />

                  <button
                    role="menuitem"
                    onClick={() => handleNavClick('pricing')}
                    className={`w-full text-left p-2.5 rounded-lg hover:bg-[#132E52] transition-colors flex items-start gap-2.5 ${currentPage === 'pricing' ? 'bg-[#132E52]' : ''}`}
                  >
                    <DollarSign className="w-4 h-4 text-[#C99A3D] mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-slate-100">Pricing &amp; Engagements</div>
                      <div className="text-[11px] text-slate-400">Transparent advisory pricing models</div>
                    </div>
                  </button>

                  <button
                    role="menuitem"
                    onClick={() => handleNavClick('careers')}
                    className={`w-full text-left p-2.5 rounded-lg hover:bg-[#132E52] transition-colors flex items-start gap-2.5 ${currentPage === 'careers' ? 'bg-[#132E52]' : ''}`}
                  >
                    <Briefcase className="w-4 h-4 text-[#C99A3D] mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-slate-100">Careers &amp; Opportunities</div>
                      <div className="text-[11px] text-slate-400">Open Accounting &amp; Preparer Roles</div>
                    </div>
                  </button>

                  <div className="h-px bg-[#1E3A5F]/70 my-1" />

                  <button
                    role="menuitem"
                    onClick={() => handleNavClick('founder')}
                    className={`w-full text-left p-2.5 rounded-lg hover:bg-[#132E52] transition-colors flex items-start gap-2.5 ${currentPage === 'founder' ? 'bg-[#132E52]' : ''}`}
                  >
                    <UserIcon className="w-4 h-4 text-[#C99A3D] mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-slate-100">Meet Desmond Hinds</div>
                      <div className="text-[11px] text-slate-400">Founder &amp; Senior Managing Accountant</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </nav>

          {/* DESKTOP UTILITY ACTIONS (Placed separately on the right) */}
          <div className="hidden lg:flex items-center gap-2 xl:gap-3 flex-shrink-0">
            {/* 1. Client Portal CTA */}
            <button
              type="button"
              onClick={handlePortalAction}
              className="h-9 xl:h-10 px-2.5 xl:px-4 rounded-xl text-xs font-semibold text-slate-100 bg-[#0D2340] hover:bg-[#132E52] border border-[#1E3A5F] hover:border-[#C99A3D]/50 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C99A3D]"
              aria-label="Client Portal"
            >
              <Lock className="w-3.5 h-3.5 text-[#C99A3D] flex-shrink-0" />
              <span>
                <span className="hidden xl:inline">Client </span>Portal
              </span>
            </button>

            {/* 2. Book Consultation CTA */}
            <button
              type="button"
              onClick={() => handleNavClick('book_consultation')}
              className="h-9 xl:h-10 px-3 xl:px-4.5 rounded-xl text-xs font-bold text-[#06172C] bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] hover:brightness-105 transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#C99A3D]"
              aria-label="Book a Consultation"
            >
              <Calendar className="w-3.5 h-3.5 text-[#06172C] flex-shrink-0" />
              <span>Book Consultation</span>
            </button>
          </div>

          {/* TABLET / MOBILE QUICK ACTIONS (< 1024px, responsive down to 320px) */}
          <div className="flex lg:hidden items-center gap-2 flex-shrink-0">
            {/* Client Portal Button */}
            <button
              type="button"
              onClick={handlePortalAction}
              className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg text-[11px] sm:text-xs font-semibold text-slate-100 bg-[#0D2340] border border-[#1E3A5F] hover:border-[#C99A3D]/50 transition-colors flex items-center gap-1.5 whitespace-nowrap"
              aria-label="Client Portal"
            >
              <Lock className="w-3 h-3 text-[#C99A3D] flex-shrink-0" />
              <span className="hidden xs:inline">Client </span>
              <span>Portal</span>
            </button>

            {/* Hamburger Button (min 40-44px touch target) */}
            <button
              ref={hamburgerBtnRef}
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="w-10 h-10 sm:w-11 sm:h-11 min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center rounded-xl text-slate-200 hover:text-white bg-[#0D2340]/60 hover:bg-[#0B2748] border border-[#1E3A5F] transition-colors focus:outline-none focus:ring-2 focus:ring-[#C99A3D]"
              aria-label="Open Navigation Menu"
              aria-expanded={mobileMenuOpen}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

        </div>
      </div>

      {/* MOBILE MENU SIDE DRAWER & BACKDROP */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation Menu"
        >
          {/* Backdrop Overlay */}
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Container */}
          <div 
            ref={mobileDrawerRef}
            className="relative w-full max-w-sm bg-[#06172C] border-l border-[#0B2748] shadow-2xl flex flex-col justify-between z-50 h-full overflow-y-auto animate-in slide-in-from-right duration-200"
          >
            {/* Drawer Top Header */}
            <div className="p-4 border-b border-[#0B2748] flex items-center justify-between bg-[#050E1A]">
              <BrandLogo 
                size="sm" 
                variant="compact"
                onClick={() => handleNavClick('home')} 
              />
              
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-[#0B2748] border border-[#0B2748] transition-colors focus:outline-none focus:ring-2 focus:ring-[#C99A3D]"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Links */}
            <div className="flex-1 px-4 py-4 space-y-1">
              {/* Home */}
              <button
                type="button"
                onClick={() => handleNavClick('home')}
                className={`w-full text-left px-3.5 py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-between min-h-[44px] ${
                  currentPage === 'home' 
                    ? 'bg-[#0B2748] text-[#E2BD67] font-semibold border-l-4 border-[#C99A3D]' 
                    : 'text-slate-200 hover:bg-[#0B2748]/60 hover:text-white'
                }`}
              >
                <span>Home</span>
                {currentPage === 'home' && <span className="w-1.5 h-1.5 rounded-full bg-[#C99A3D]" />}
              </button>

              {/* About Us */}
              <button
                type="button"
                onClick={() => handleNavClick('about')}
                className={`w-full text-left px-3.5 py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-between min-h-[44px] ${
                  currentPage === 'about' 
                    ? 'bg-[#0B2748] text-[#E2BD67] font-semibold border-l-4 border-[#C99A3D]' 
                    : 'text-slate-200 hover:bg-[#0B2748]/60 hover:text-white'
                }`}
              >
                <span>About Us</span>
                {currentPage === 'about' && <span className="w-1.5 h-1.5 rounded-full bg-[#C99A3D]" />}
              </button>

              {/* Collapsible Services */}
              <div>
                <button
                  type="button"
                  onClick={() => setMobileServicesOpen(!mobileServicesOpen)}
                  className="w-full text-left px-3.5 py-3 rounded-xl text-sm font-medium text-slate-200 hover:bg-[#0B2748]/60 hover:text-white transition-colors flex items-center justify-between min-h-[44px]"
                  aria-expanded={mobileServicesOpen}
                >
                  <span className={currentPage === 'services' ? 'text-[#E2BD67] font-semibold' : ''}>
                    Services
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${mobileServicesOpen ? 'rotate-180 text-[#E2BD67]' : 'text-slate-400'}`} />
                </button>

                {mobileServicesOpen && (
                  <div className="pl-4 pr-1 py-1 space-y-1 bg-[#050E1A]/60 rounded-xl my-1 border border-[#0B2748]">
                    <button
                      type="button"
                      onClick={() => handleNavClick('services')}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-[#E2BD67] hover:underline"
                    >
                      All Comprehensive Services &rarr;
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavClick('services')}
                      className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white"
                    >
                      &bull; Individual Tax Filings (1040, W-2)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavClick('services')}
                      className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white"
                    >
                      &bull; Business Tax &amp; Bookkeeping (LLC, S-Corp)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavClick('services')}
                      className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white"
                    >
                      &bull; Financial Protection &amp; Estates
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavClick('services')}
                      className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white"
                    >
                      &bull; Credit &amp; Financial Solutions
                    </button>
                  </div>
                )}
              </div>

              {/* Collapsible Industries */}
              <div>
                <button
                  type="button"
                  onClick={() => setMobileIndustriesOpen(!mobileIndustriesOpen)}
                  className="w-full text-left px-3.5 py-3 rounded-xl text-sm font-medium text-slate-200 hover:bg-[#0B2748]/60 hover:text-white transition-colors flex items-center justify-between min-h-[44px]"
                  aria-expanded={mobileIndustriesOpen}
                >
                  <span className={currentPage === 'industries' ? 'text-[#E2BD67] font-semibold' : ''}>
                    Specialized Industries
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${mobileIndustriesOpen ? 'rotate-180 text-[#E2BD67]' : 'text-slate-400'}`} />
                </button>

                {mobileIndustriesOpen && (
                  <div className="pl-4 pr-1 py-1 space-y-1 bg-[#050E1A]/60 rounded-xl my-1 border border-[#0B2748]">
                    <button
                      type="button"
                      onClick={() => handleNavClick('industries')}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-[#E2BD67] hover:underline"
                    >
                      All 8 Commercial Sectors &rarr;
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavClick('industries')}
                      className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white"
                    >
                      &bull; Construction &amp; Contractors
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavClick('industries')}
                      className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white"
                    >
                      &bull; Real Estate Investors &amp; Syndications
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavClick('industries')}
                      className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white"
                    >
                      &bull; Healthcare &amp; Medical Practices
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavClick('industries')}
                      className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white"
                    >
                      &bull; Legal &amp; Professional Services
                    </button>
                  </div>
                )}
              </div>

              {/* Collapsible Tax Strategies */}
              <div>
                <button
                  type="button"
                  onClick={() => setMobileStrategiesOpen(!mobileStrategiesOpen)}
                  className="w-full text-left px-3.5 py-3 rounded-xl text-sm font-medium text-slate-200 hover:bg-[#0B2748]/60 hover:text-white transition-colors flex items-center justify-between min-h-[44px]"
                  aria-expanded={mobileStrategiesOpen}
                >
                  <span className={currentPage === 'tax_strategies' ? 'text-[#E2BD67] font-semibold' : ''}>
                    Tax Strategies
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${mobileStrategiesOpen ? 'rotate-180 text-[#E2BD67]' : 'text-slate-400'}`} />
                </button>

                {mobileStrategiesOpen && (
                  <div className="pl-4 pr-1 py-1 space-y-1 bg-[#050E1A]/60 rounded-xl my-1 border border-[#0B2748]">
                    <button
                      type="button"
                      onClick={() => handleNavClick('tax_strategies')}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-[#E2BD67] hover:underline"
                    >
                      Full Strategies Catalog (16 Domains) &rarr;
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavClick('tax_strategies')}
                      className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white"
                    >
                      &bull; High-Net-Worth &amp; Executives
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavClick('tax_strategies')}
                      className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white"
                    >
                      &bull; Small Business Pass-Throughs
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavClick('tax_strategies')}
                      className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white"
                    >
                      &bull; Real Estate &amp; Capital Assets
                    </button>
                  </div>
                )}
              </div>

              {/* Pricing */}
              <button
                type="button"
                onClick={() => handleNavClick('pricing')}
                className={`w-full text-left px-3.5 py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-between min-h-[44px] ${
                  currentPage === 'pricing' 
                    ? 'bg-[#0B2748] text-[#E2BD67] font-semibold border-l-4 border-[#C99A3D]' 
                    : 'text-slate-200 hover:bg-[#0B2748]/60 hover:text-white'
                }`}
              >
                <span>Pricing &amp; Engagements</span>
                {currentPage === 'pricing' && <span className="w-1.5 h-1.5 rounded-full bg-[#C99A3D]" />}
              </button>

              {/* Contact */}
              <button
                type="button"
                onClick={() => handleNavClick('contact')}
                className={`w-full text-left px-3.5 py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-between min-h-[44px] ${
                  currentPage === 'contact' 
                    ? 'bg-[#0B2748] text-[#E2BD67] font-semibold border-l-4 border-[#C99A3D]' 
                    : 'text-slate-200 hover:bg-[#0B2748]/60 hover:text-white'
                }`}
              >
                <span>Contact Us</span>
                {currentPage === 'contact' && <span className="w-1.5 h-1.5 rounded-full bg-[#C99A3D]" />}
              </button>

              {/* Secondary Links */}
              <div className="pt-2 border-t border-[#0B2748] space-y-1">
                <button
                  type="button"
                  onClick={() => handleNavClick('founder')}
                  className="w-full text-left px-3.5 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-[#0B2748]/40 flex items-center gap-2"
                >
                  <UserIcon className="w-3.5 h-3.5 text-[#C99A3D]" />
                  <span>Meet Desmond Hinds</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavClick('resources')}
                  className="w-full text-left px-3.5 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-[#0B2748]/40 flex items-center gap-2"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-[#C99A3D]" />
                  <span>Resources &amp; Tax FAQ</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavClick('careers')}
                  className="w-full text-left px-3.5 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-[#0B2748]/40 flex items-center gap-2"
                >
                  <Briefcase className="w-3.5 h-3.5 text-[#C99A3D]" />
                  <span>Careers &amp; Recruitment</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.location.hash = '#/portals';
                    window.history.pushState(null, '', '/portals');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-[#0B2748]/40 flex items-center gap-2"
                >
                  <Layers className="w-3.5 h-3.5 text-[#C99A3D]" />
                  <span>Staff &amp; Client Portals (29 Roles)</span>
                </button>
              </div>

            </div>

            {/* Drawer Bottom CTAs */}
            <div className="p-4 border-t border-[#0B2748] bg-[#050E1A] space-y-2.5">
              {/* Telephone Direct Line */}
              <a 
                href="tel:678-205-9486" 
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-semibold text-slate-200 hover:text-white bg-[#0B2748] border border-[#0B2748] hover:border-[#C99A3D]/50 transition-colors min-h-[44px]"
              >
                <Phone className="w-4 h-4 text-[#C99A3D]" />
                <span>Call Directly: 678-205-9486</span>
              </a>

              {/* Portal CTA */}
              <button
                type="button"
                onClick={handlePortalAction}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-slate-100 bg-[#0D2340] border border-[#1E3A5F] hover:border-[#C99A3D]/50 transition-colors min-h-[44px]"
              >
                <Lock className="w-4 h-4 text-[#C99A3D]" />
                <span>{getPortalButtonLabel()}</span>
              </button>

              {/* Book Consultation CTA */}
              <button
                type="button"
                onClick={() => handleNavClick('book_consultation')}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-[#06172C] bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] hover:brightness-105 shadow-md active:scale-95 transition-all min-h-[44px]"
              >
                <Calendar className="w-4 h-4 text-[#06172C]" />
                <span>Book a Consultation</span>
              </button>

              <div className="text-center pt-1">
                <span className="text-[10px] text-slate-500">
                  Columbia, SC &bull; Preserving Wealth. Building Legacies.
                </span>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

