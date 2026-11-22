import React from 'react';
import { SecureFinancialVaultVisual } from './SecureFinancialVaultVisual';
import { FinancialTransparencyNetwork } from './FinancialTransparencyNetwork';

interface ClientPortalTechnologyHeroProps {
  /** Controls ambient animation playback for off-screen and reduced-motion pausing. */
  animate: boolean;
}

/**
 * Left-hand ~55% desktop presentation showcasing Destria's secure digital financial gateway,
 * enterprise vault visual, and conceptual transparency lifecycle.
 * Strictly presentational; never receives credentials or account state.
 */
export const ClientPortalTechnologyHero: React.FC<ClientPortalTechnologyHeroProps> = ({
  animate
}) => {
  return (
    <div className="flex flex-col justify-between space-y-6">
      {/* Editorial Gateway Introduction */}
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D4A843]">
          Destria Client Financial Gateway
        </p>
        <h2 className="font-serif text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl lg:text-[2.15rem]">
          Protected Financial Access.{' '}
          <span className="text-[#E1BB60]">Transparent Professional Oversight.</span>
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-300">
          Your private digital environment for sharing tax documentation, tracking return preparation
          milestones, and communicating directly with Destria Tax Services LLC professionals.
        </p>
      </div>

      {/* Photorealistic Digital Financial Vault Visualization */}
      <SecureFinancialVaultVisual animate={animate} />

      {/* Conceptual Blockchain-Inspired Financial Transparency Workflow */}
      <FinancialTransparencyNetwork animate={animate} />
    </div>
  );
};
