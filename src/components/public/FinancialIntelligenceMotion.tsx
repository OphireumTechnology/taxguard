import React from 'react';
import { BrainCircuit, FileText, ScanText, Calculator, ChartNoAxesCombined, UserRoundCheck, ShieldCheck } from 'lucide-react';

const stages = [
  { title: 'Document Intake', subtitle: 'Secure source records', Icon: FileText },
  { title: 'AI Recognition', subtitle: 'Assisted data extraction', Icon: ScanText },
  { title: 'Accounting', subtitle: 'Structured classification', Icon: Calculator },
  { title: 'Tax Intelligence', subtitle: 'Analysis and insights', Icon: BrainCircuit },
  { title: 'Professional Review', subtitle: 'Human verification', Icon: UserRoundCheck },
  { title: 'Secure Reporting', subtitle: 'Controlled delivery', Icon: ShieldCheck }
];

/** Decorative, illustrative workflow; never displays or processes client data. */
export const FinancialIntelligenceMotion: React.FC = () => (
  <section aria-labelledby="financial-intelligence-title" className="relative isolate max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <style>{`
      @keyframes destria-flow { from { stroke-dashoffset: 120; } to { stroke-dashoffset: 0; } }
      @keyframes destria-drift { 0%,100% { transform: translate3d(0,0,0); opacity:.4; } 50% { transform: translate3d(0,-10px,0); opacity:.85; } }
      @keyframes destria-pulse { 0%,100% { opacity:.45; box-shadow: 0 0 0 rgba(201,154,53,0); } 50% { opacity:1; box-shadow: 0 0 20px rgba(201,154,53,.2); } }
      .destria-flow-line { stroke-dasharray: 5 10; animation: destria-flow 8s linear infinite; }
      .destria-orb { animation: destria-drift 7s ease-in-out infinite; }
      .destria-node { animation: destria-pulse 5s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        .destria-flow-line,.destria-orb,.destria-node { animation: none !important; }
      }
    `}</style>
    <div className="relative overflow-hidden rounded-3xl border border-[#C99A35]/30 bg-gradient-to-br from-[#0D2745] via-[#071D3A] to-[#041427] px-5 py-9 sm:px-9 sm:py-12 shadow-2xl">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="destria-orb absolute -top-24 right-[12%] h-64 w-64 rounded-full bg-[#1677C8]/10 blur-3xl" />
        <div className="destria-orb absolute -bottom-32 left-[8%] h-72 w-72 rounded-full bg-[#C99A35]/10 blur-3xl" style={{animationDelay:'-3s'}} />
        <svg viewBox="0 0 1000 260" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-25" focusable="false">
          <defs><linearGradient id="destria-network" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#C99A35"/><stop offset=".55" stopColor="#58A6E7"/><stop offset="1" stopColor="#C99A35"/></linearGradient></defs>
          <path d="M0 65 Q180 10 350 90 T700 100 T1000 40 M0 190 Q220 110 420 180 T780 150 T1000 205" stroke="url(#destria-network)" fill="none" strokeWidth="1.5" className="destria-flow-line" />
          {[[85,61],[260,72],[470,170],[690,96],[865,160]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="3" fill="#E5B552"/>)}
        </svg>
      </div>
      <div className="relative z-10 text-center">
        <span className="text-[11px] font-bold uppercase tracking-[.24em] text-[#E5B552]">Connected Financial Intelligence</span>
        <h2 id="financial-intelligence-title" className="mt-3 font-serif text-2xl font-bold tracking-tight text-white sm:text-4xl">The Intelligence Behind Modern Accounting</h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-300">An illustrative journey from financial documents to AI-assisted analysis, professional verification and secure reporting.</p>
      </div>
      <div className="relative z-10 mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6 xl:gap-2">
        {stages.map(({title,subtitle,Icon},index)=>(
          <div key={title} className="relative min-w-0">
            <div className="destria-node flex h-full min-h-[142px] flex-col items-center justify-center rounded-2xl border border-[#C99A35]/25 bg-[#0A2039]/90 p-4 text-center backdrop-blur-sm" style={{animationDelay:`${index * -.7}s`}}>
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-[#C99A35]/45 bg-[#C99A35]/10 text-[#E5B552]"><Icon size={23} strokeWidth={1.7} aria-hidden="true"/></div>
              <h3 className="text-xs font-bold text-white">{title}</h3>
              <p className="mt-1 text-[11px] leading-4 text-slate-400">{subtitle}</p>
            </div>
            {index < stages.length-1 && <span aria-hidden="true" className="pointer-events-none absolute -right-2 top-1/2 z-20 hidden h-1 w-4 -translate-y-1/2 rounded-full bg-[#E5B552] shadow-[0_0_10px_#C99A35] xl:block" />}
          </div>
        ))}
      </div>
      <div className="relative z-10 mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-medium text-slate-300">
        <span className="flex items-center gap-2"><ChartNoAxesCombined size={14} className="text-[#E5B552]"/> AI-assisted financial workflows</span>
        <span className="flex items-center gap-2"><ShieldCheck size={14} className="text-[#E5B552]"/> Human oversight and secure processes</span>
      </div>
    </div>
  </section>
);
