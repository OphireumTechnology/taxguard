/**
 * A/R Tax Services, LLC - Standardized Enterprise Error Pages
 * Strict black-and-white presentation with clear plain-language explanations and developer notice.
 */

import React from 'react';
import { DeveloperContactNotice } from './DeveloperContactNotice';
import { DemoBanner } from './DemoBanner';
import { AlertCircle, ArrowLeft, RotateCcw, Home, Lock } from 'lucide-react';

export type ErrorPageType = 
  | '401'
  | '403'
  | '404'
  | '408'
  | '429'
  | '500'
  | '503'
  | 'session_expired'
  | 'account_locked'
  | 'maintenance';

interface ErrorConfig {
  code: string;
  title: string;
  explanation: string;
  safeAction: string;
  recommendedRoleLogin?: string;
}

const ERROR_CONFIGS: Record<ErrorPageType, ErrorConfig> = {
  '401': {
    code: 'HTTP 401',
    title: 'Unauthorized Access',
    explanation: 'No valid demonstration authentication token was found for this workspace route. Protected role sessions require prior credential verification.',
    safeAction: 'Please navigate to the specific role login portal and authenticate using your demonstration credentials.',
    recommendedRoleLogin: '#/client/login'
  },
  '403': {
    code: 'HTTP 403',
    title: 'Forbidden Access / Role Boundary Protected',
    explanation: 'Your active demonstration session does not possess the procedural privileges required to access this specific practice workspace.',
    safeAction: 'Please sign out and sign in using the appropriate role portal (e.g., Accountant, Senior Reviewer, or Administrator).',
    recommendedRoleLogin: '#/client/login'
  },
  '404': {
    code: 'HTTP 404',
    title: 'Resource or Route Not Found',
    explanation: 'The requested demonstration path, document dossier, or practice endpoint does not exist or has been reorganized.',
    safeAction: 'Return to the public homepage or your active role dashboard to navigate via the verified practice menu.',
    recommendedRoleLogin: '#/'
  },
  '408': {
    code: 'HTTP 408',
    title: 'Request Timeout',
    explanation: 'The demonstration container or virtual network simulated handshake took longer than the allowable threshold.',
    safeAction: 'Refresh the page or re-attempt the previous operation. No changes were committed.',
    recommendedRoleLogin: '#/'
  },
  '429': {
    code: 'HTTP 429',
    title: 'Too Many Attempts / Rate Limit Enforced',
    explanation: 'Consecutive rapid authentication attempts exceeded the 5-attempt security threshold. A temporary lockout has been initiated.',
    safeAction: 'Wait 60 seconds for the temporary security cooldown to expire before re-entering credentials.',
    recommendedRoleLogin: '#/client/login'
  },
  '500': {
    code: 'HTTP 500',
    title: 'Demonstration System Error',
    explanation: 'An unexpected application state or unhandled exception was captured by the boundary controller.',
    safeAction: 'Use the buttons below to return safely to the public site or reload your role dashboard.',
    recommendedRoleLogin: '#/'
  },
  '503': {
    code: 'HTTP 503',
    title: 'Feature Not Configured (Phase 2)',
    explanation: 'The requested third-party connector or external service integration is currently maintained in "Not Configured" demonstration status.',
    safeAction: 'Review the Integration Registry to inspect credentials and data exchange architecture requirements for Phase 2.',
    recommendedRoleLogin: '#/'
  },
  'session_expired': {
    code: 'SEC-EXP',
    title: 'Demonstration Session Expired',
    explanation: 'Your isolated role session has reached its 4-hour demonstration expiration limit or was invalidated by another window.',
    safeAction: 'Sign in again to establish a fresh authenticated role token.',
    recommendedRoleLogin: '#/client/login'
  },
  'account_locked': {
    code: 'SEC-LOCK',
    title: 'Temporary Account Lockout Active',
    explanation: 'Maximum allowable failed login attempts were exceeded for this role. Account is locked for 60 seconds to simulate brute-force protection.',
    safeAction: 'Wait for the countdown timer to conclude, verify your demonstration credentials, and retry.',
    recommendedRoleLogin: '#/client/login'
  },
  'maintenance': {
    code: 'SYS-MAINT',
    title: 'System Demonstration Maintenance',
    explanation: 'The practice demonstration environment is undergoing simulated maintenance window synchronization.',
    safeAction: 'Return to the public website or check back shortly.',
    recommendedRoleLogin: '#/'
  }
};

interface ErrorPageViewProps {
  type: ErrorPageType;
  customMessage?: string;
  onNavigateHome?: () => void;
  onNavigateLogin?: (targetPath?: string) => void;
}

export const ErrorPageView: React.FC<ErrorPageViewProps> = ({
  type,
  customMessage,
  onNavigateHome = () => { window.location.hash = '#/'; },
  onNavigateLogin = (path = '#/client/login') => { window.location.hash = path; }
}) => {
  const config = ERROR_CONFIGS[type] || ERROR_CONFIGS['404'];

  // Route directly to login page if 401 Unauthorized occurs
  React.useEffect(() => {
    if (type === '401') {
      onNavigateLogin(config.recommendedRoleLogin || '#/client/login');
    }
  }, [type, onNavigateLogin, config.recommendedRoleLogin]);

  return (
    <div className="min-h-screen bg-white text-black flex flex-col font-sans antialiased selection:bg-black selection:text-white">
      {/* Persistent Demo Banner */}
      <DemoBanner />

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-lg border border-black bg-white p-6 sm:p-8 space-y-6">
          {/* Header Badge & Code */}
          <div className="space-y-2 border-b border-neutral-300 pb-4">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-black font-mono text-xs font-bold uppercase">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{config.code}</span>
            </div>
            <h1 className="text-lg font-bold text-black uppercase tracking-tight">
              {config.title}
            </h1>
          </div>

          {/* Plain-Language Explanation */}
          <div className="space-y-2 text-xs text-neutral-800 leading-relaxed">
            <div className="font-semibold text-black">Explanation:</div>
            <p>{customMessage || config.explanation}</p>

            <div className="font-semibold text-black pt-2">Recommended Safe Action:</div>
            <p className="bg-neutral-50 p-2.5 border border-neutral-200 font-medium">
              {config.safeAction}
            </p>
          </div>

          {/* Mandatory Reusable Developer Support Notice */}
          <DeveloperContactNotice reason={`${config.code} - ${config.title}`} />

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-neutral-200">
            <button
              onClick={() => onNavigateLogin(config.recommendedRoleLogin)}
              className="w-full sm:w-auto flex-1 py-2 px-4 bg-black text-white text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 rounded-none"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Return to Login</span>
            </button>

            <button
              onClick={onNavigateHome}
              className="w-full sm:w-auto flex-1 py-2 px-4 border border-black text-black text-xs font-bold uppercase tracking-wider hover:bg-neutral-100 transition-colors flex items-center justify-center gap-2 rounded-none"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Return to Home</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
