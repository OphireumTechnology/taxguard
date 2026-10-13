import React from 'react';
import { AlertCircle } from 'lucide-react';
import { isSupabaseConfigured } from '../../supabase/config';

/**
 * Warns before credential entry when browser authentication is not configured.
 * Shows no configuration values or issue details to end users.
 */
export const AuthConfigurationNotice: React.FC<{ configured?: boolean }> = ({ configured = isSupabaseConfigured() }) => {
  if (configured) return null;
  return (
    <div
      role="alert"
      data-testid="auth-not-configured"
      className="p-3 rounded-lg bg-amber-900/40 border border-amber-500/40 text-amber-100 text-xs flex items-center gap-2"
    >
      <AlertCircle className="w-4 h-4 text-amber-300 shrink-0" />
      <span>Sign-in is unavailable: TaxGuard authentication has not been configured for this environment. Please contact your administrator.</span>
    </div>
  );
};
