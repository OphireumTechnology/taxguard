import React from 'react';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from '../common/BrandLogo';
import { BRAND_ASSETS } from '../../utils/assets';
import { FounderPortrait, EditorialSplitImage } from './images';
import { 
  Target, 
  Compass, 
  CheckCircle2, 
  ShieldCheck, 
  Users, 
  BookOpen, 
  HeartHandshake, 
  Award,
  Sparkles,
  Building,
  GraduationCap,
  MapPin,
  ArrowRight
} from 'lucide-react';

export const AboutPage: React.FC = () => {
  const { setCurrentPage } = useApp();

  const values = [
    {
      title: 'Accuracy',
      desc: 'Precision is paramount in accounting. We cross-verify all documents and data points with multi-tiered professional accounting reviews.',
      icon: Award
    },
    {
      title: 'Integrity',
      desc: 'We operate with uncompromising ethical standards, honoring your trust and ensuring full statutory compliance.',
      icon: ShieldCheck
    },
    {
      title: 'Transparency',
      desc: 'No hidden fees, no opaque algorithms. Clear upfront pricing and plain-English explanations of all deductions and filings.',
      icon: CheckCircle2
    },
    {
      title: 'Client-First Service',
      desc: 'Your goals and peace of mind guide every strategy. We structure our advisory around your unique personal and business needs.',
      icon: Users
    },
    {
      title: 'Education',
      desc: 'Empowering clients through knowledge. We clarify complex tax laws so you make confident, informed financial choices.',
      icon: BookOpen
    },
    {
      title: 'Long-Term Relationships',
      desc: 'We are your steadfast year-round advocates, supporting your growth from early ventures to multi-generational wealth.',
      icon: HeartHandshake
    },
    {
      title: 'Community Impact',
      desc: 'Committed to building stronger communities in South Carolina and beyond through accessible financial education programs.',
      icon: Building
    }
  ];

  return (
    <div className="space-y-20 pb-20 text-slate-100">
      
      {/* Header Banner */}
      <section className="relative pt-10 pb-12 border-b border-[#1E3A5F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            <div className="lg:col-span-7 space-y-4 text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0D2340] border border-[#C6A15B]/40 text-[#C6A15B] text-xs font-semibold">
                <MapPin className="w-3.5 h-3.5 text-[#C6A15B]" />
                <span>Our Heritage &amp; Purpose &bull; Columbia, South Carolina</span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight">
                About A/R Tax Services, LLC
              </h1>
              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
                Your Trusted Partner in Tax and Financial Solutions. Delivering client-focused tax preparation, 
                strategic business accounting, and legacy preservation built upon trust, transparency, and accuracy.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <button
                  onClick={() => setCurrentPage('founder')}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-[#06172C] bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] hover:brightness-105 transition-all shadow-md"
                >
                  Meet Founder Desmond Hinds
                </button>
                <button
                  onClick={() => setCurrentPage('services')}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-200 bg-[#0D2340] border border-[#1E3A5F] hover:border-[#C6A15B]/50 transition-colors"
                >
                  Explore Practice Services
                </button>
              </div>
            </div>

            {/* Architectural Building Photo */}
            <div className="lg:col-span-5">
              <div className="relative rounded-2xl overflow-hidden border border-[#C6A15B]/40 bg-[#0D2340] shadow-2xl group">
                <picture>
                  <source srcSet={BRAND_ASSETS.columbiaSkylineWebp} type="image/webp" />
                  <img
                    src={BRAND_ASSETS.columbiaSkylineJpg}
                    alt="A/R Tax Services headquarters in Columbia, South Carolina"
                    width={600}
                    height={400}
                    loading="eager"
                    decoding="async"
                    className="w-full h-64 sm:h-72 object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                </picture>
                <div className="absolute inset-0 bg-gradient-to-t from-[#06172C] via-transparent to-transparent" />
                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs text-white">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <MapPin className="w-4 h-4 text-[#C6A15B]" />
                    <span>Columbia, South Carolina Headquarters</span>
                  </div>
                  <span className="text-[10px] text-[#C6A15B] font-mono uppercase bg-[#06172C]/80 px-2 py-0.5 rounded border border-[#1E3A5F]">
                    Established
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Mission & Vision Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Mission */}
          <div className="p-8 rounded-3xl bg-[#0D2340] border border-[#1E3A5F] hover:border-[#C6A15B]/50 transition-all space-y-4">
            <div className="p-3 w-fit rounded-xl bg-[#07172B] text-[#C6A15B] border border-[#1E3A5F]">
              <Target className="w-6 h-6" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-white">Our Mission</h2>
            <p className="text-sm sm:text-base text-slate-200 font-serif italic leading-relaxed border-l-2 border-[#C6A15B] pl-4">
              “To deliver premium tax, accounting and financial advisory services that preserve wealth and build legacies for every client.”
            </p>
            <p className="text-xs text-slate-300 leading-relaxed pt-2">
              We provide accurate, transparent, and client-focused tax preparation and financial support services that empower individuals, entrepreneurs, and families to make confident financial decisions.
            </p>
          </div>

          {/* Vision */}
          <div className="p-8 rounded-3xl bg-[#0D2340] border border-[#1E3A5F] hover:border-[#C6A15B]/50 transition-all space-y-4">
            <div className="p-3 w-fit rounded-xl bg-[#07172B] text-[#C6A15B] border border-[#1E3A5F]">
              <Compass className="w-6 h-6" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-white">Our Vision</h2>
            <p className="text-sm sm:text-base text-slate-200 font-serif italic leading-relaxed border-l-2 border-[#C6A15B] pl-4">
              “To be the trusted financial partner that individuals and businesses turn to for clarity, confidence and long-term prosperity.”
            </p>
            <p className="text-xs text-slate-300 leading-relaxed pt-2">
              We strive to be a trusted leader in tax and financial solutions, known for integrity, innovation, and a lasting positive impact on our clients, families, and communities.
            </p>
          </div>

        </div>
      </section>

      {/* Leadership Spotlight: Founder & CEO */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-br from-[#0B2748] to-[#06172C] border border-[#C99A3D]/40 p-8 sm:p-10 lg:p-12 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Approved Founder Portrait */}
            <div className="lg:col-span-5 flex justify-center">
              <FounderPortrait
                size="lg"
                priority={false}
                caption="Desmond Hinds • Founder & Chief Executive Officer"
                className="w-full max-w-md"
              />
            </div>

            {/* Leadership Message & Credentials */}
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-bold tracking-widest text-[#C99A3D] uppercase">
                  Executive Leadership
                </span>
                <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white leading-tight">
                  A Message from Desmond Hinds
                </h2>
                <div className="text-xs font-semibold text-[#E2BD67]">
                  Founder &amp; Chief Executive Officer &bull; Columbia, South Carolina
                </div>
              </div>

              <blockquote className="p-4 rounded-xl bg-[#06172C]/90 border-l-4 border-[#C99A3D] text-[#F8F6F1] font-serif italic text-base sm:text-lg">
                &ldquo;Your Growth, Our Priority. We established A/R Tax Services, LLC to give individuals, families, and businesses confidential, executive-tier tax counsel they can rely on through every economic season.&rdquo;
              </blockquote>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Desmond established the firm to bring integrity, accuracy, and strategic foresight to every client relationship. Combining rigorous tax statutory knowledge with a client-first approach, our firm empowers clients to navigate complex regulations with absolute confidence.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setCurrentPage('founder')}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-[#06172C] bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] hover:brightness-105 transition-all shadow-md"
                >
                  View Full Executive Profile
                </button>
                <button
                  onClick={() => setCurrentPage('book_consultation')}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-200 bg-[#0B2748] border border-[#C99A3D]/40 hover:border-[#C99A3D] transition-colors"
                >
                  Schedule Private Consultation
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 7 Core Values */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
          <span className="text-xs font-bold tracking-widest text-[#C6A15B] uppercase">
            Principles We Live By
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white">
            Our Core Values
          </h2>
          <p className="text-sm text-slate-300">
            These foundational standards govern every client consultation, balance sheet, and tax preparation we deliver.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {values.map((v, i) => (
            <div key={i} className="p-6 rounded-2xl bg-[#0D2340]/60 border border-[#1E3A5F] space-y-3">
              <div className="p-2.5 w-fit rounded-lg bg-[#07172B] text-[#C6A15B]">
                <v.icon className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-lg font-bold text-white">{v.title}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Community & Impact */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-r from-[#0D2340] to-[#07172B] border border-[#C6A15B]/40 p-8 sm:p-12 lg:p-14 space-y-8">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-bold tracking-widest text-[#C6A15B] uppercase">
              Giving Back
            </span>
            <h2 className="font-serif text-3xl font-bold text-white">
              Community & Impact: Building Stronger Futures
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              At A/R Tax Services, LLC, we believe that stronger individuals and businesses create stronger communities. 
              We are committed to financial education, empowerment, and supporting initiatives that help families and entrepreneurs build better futures.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { title: 'Financial Literacy', desc: 'Workshops on budgeting and credit fundamentals.' },
              { title: 'Small Business Support', desc: 'Guidance for local startups and sole proprietors.' },
              { title: 'Community Engagement', desc: 'Civic partnerships across South Carolina.' },
              { title: 'Education & Resources', desc: 'Free tax organizers and compliance seminars.' },
              { title: 'Long-Term Impact', desc: 'Generational wealth initiatives for families.' }
            ].map((c, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-[#07172B] border border-[#1E3A5F] space-y-1">
                <div className="text-xs font-bold text-[#C6A15B]">{c.title}</div>
                <p className="text-[11px] text-slate-400">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Strategic Partnerships */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-[#0D2340] border border-[#1E3A5F] overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
            
            <div className="lg:col-span-7 p-8 sm:p-10 space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-bold tracking-widest text-[#C6A15B] uppercase">
                  Collaborative Excellence
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white">
                  Strategic Partnerships &amp; Advisory Network
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  We value strategic partnerships with attorneys, wealth managers, and civic organizations that share our commitment to client financial well-being. Together, we expand access to resources, create opportunities, and make a lasting difference.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-medium text-slate-300">
                <div className="p-3 rounded-xl bg-[#07172B] border border-[#1E3A5F]">
                  <div className="font-bold text-[#C6A15B]">Professional Referrals</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Attorney &amp; banking networks</div>
                </div>
                <div className="p-3 rounded-xl bg-[#07172B] border border-[#1E3A5F]">
                  <div className="font-bold text-[#C6A15B]">Business Collaborations</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Corporate &amp; payroll integrations</div>
                </div>
                <div className="p-3 rounded-xl bg-[#07172B] border border-[#1E3A5F]">
                  <div className="font-bold text-[#C6A15B]">Community Organizations</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Civic financial workshops</div>
                </div>
                <div className="p-3 rounded-xl bg-[#07172B] border border-[#1E3A5F]">
                  <div className="font-bold text-[#C6A15B]">Education Seminars</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Year-round tax literacy clinics</div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setCurrentPage('contact')}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-[#06172C] bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] hover:brightness-105 transition-all shadow-md inline-flex items-center gap-2"
                >
                  <span>Inquire About Partnerships</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 h-full min-h-[300px] p-6 flex items-center">
              <EditorialSplitImage
                src={BRAND_ASSETS.privateConsultationExpJpg}
                webpSrc={BRAND_ASSETS.privateConsultationExpWebp}
                alt="A/R Tax Services professional advisory network and strategic collaboration framework"
                badgeText="Collaborative Advisory"
                className="w-full h-full min-h-[280px]"
              />
            </div>

          </div>
        </div>
      </section>

    </div>
  );
};
