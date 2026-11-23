/*
 * OPHIREUM-IP | Proprietary Source Code
 * Project: Destria Tax Services LLC / TaxGuard — Secure Super Administrator Portal
 * Notice: Unauthorized copying, redistribution, or derivative use is prohibited.
 */
import React from 'react';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from '../common/BrandLogo';

/**
 * Explicit, zero-leakage access-denied boundary rendered when an authenticated non-Super-Administrator
 * attempts to access /admin/* routes.
 */
export const AdminAccessDeniedView: React.FC = () => {
  const { currentUser, setCurrentPage, logout } = useApp();
  const isClient =
    currentUser?.role === 'client' || currentUser?.role === 'prospective_client';

  return (
    <div
      data-testid="admin-access-denied"
      className="min-h-[75vh] bg-[#061426] px-4 py-16 text-white flex items-center justify-center"
    >
      <div
        role="alert"
        className="w-full max-w-lg rounded-2xl border border-rose-500/35 bg-[#0B1F36] p-7 shadow-[0_24px_64px_rgba(2,10,22,0.72)] space-y-5"
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <BrandLogo variant="compact" size="sm" />
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-rose-300">
            403 · Access Denied
          </span>
        </div>

        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-400/35 bg-rose-950/60 text-rose-300">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-serif text-xl font-extrabold text-white">
              Super Administrator Authorization Required
            </h1>
            <p className="text-xs leading-relaxed text-[#A8B8CC]">
              Your authenticated account does not hold Super Administrator authorization for this
              administrative workspace. Role assignments are enforced exclusively on the server and
              cannot be modified from the browser.
            </p>
          </div>
        </div>

        {currentUser && (
          <div className="rounded-xl border border-white/10 bg-[#061426]/90 px-4 py-3 text-xs text-[#CBD6E4] space-y-1">
            <div>
              Signed in as: <strong className="text-white">{currentUser.email}</strong>
            </div>
            <div>
              Assigned role:{' '}
              <code className="font-mono text-[#D4AF37]">{currentUser.role}</code>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => setCurrentPage(isClient ? 'portal' : 'staff')}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#D4AF37] px-4 py-2 text-xs font-bold text-[#061426] transition-colors hover:bg-[#E5C562] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isClient ? 'Return to Client Portal' : 'Return to Staff Workspace'}</span>
          </button>

          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-white/15 bg-[#061426] px-4 py-2 text-xs font-semibold text-[#E2EAF4] transition-colors hover:border-rose-400/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            <LogOut className="h-3.5 w-3.5 text-rose-300" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
