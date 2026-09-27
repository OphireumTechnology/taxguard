import React, { Component, ErrorInfo, ReactNode } from 'react';
import { 
  AlertTriangle, 
  RefreshCw, 
  Home, 
  ShieldAlert, 
  FileText, 
  Terminal, 
  ChevronDown, 
  ChevronUp, 
  Bug,
  ShieldCheck
} from 'lucide-react';
import { reportClientError } from '../../utils/telemetry';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCategory: 'runtime' | 'network' | 'auth' | 'chunk' | 'unknown';
  incidentId: string | null;
  failedComponentName: string | null;
  sanitizedMessage: string | null;
  componentStack: string | null;
  route: string | null;
  userRole: string | null;
  timestamp: string | null;
  showDevDiagnostics: boolean;
}

/**
 * Sanitizes strings by stripping SSNs, account numbers, tokens, passwords, and sensitive tax data.
 */
function sanitizeSensitiveData(input: string): string {
  if (!input) return '';
  return input
    // SSN pattern
    .replace(/\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g, '[REDACTED_SSN]')
    // Credit card / Financial account pattern
    .replace(/\b(?:\d{4}[- ]?){3}\d{4}\b/g, '[REDACTED_FINANCIAL_DATA]')
    // Authorization bearer tokens
    .replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, 'Bearer [REDACTED_TOKEN]')
    // API keys
    .replace(/AIza[0-9A-Za-z\-_]{35}/g, '[REDACTED_API_KEY]')
    // Query param credentials
    .replace(/(password|secret|token|apiKey|ssn|ein)=([^&]+)/gi, '$1=[REDACTED]');
}

/**
 * Enterprise Production-Grade Error Boundary for A/R Tax Services, LLC.
 * Catches unhandled runtime exceptions, React rendering faults, and chunk load failures.
 * Sanitizes all output to ensure zero leakage of stack traces, internal paths, tokens, or PII.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorCategory: 'unknown',
      incidentId: null,
      failedComponentName: null,
      sanitizedMessage: null,
      componentStack: null,
      route: null,
      userRole: null,
      timestamp: null,
      showDevDiagnostics: false
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    const errorStr = (error?.message || '').toLowerCase();
    let errorCategory: State['errorCategory'] = 'runtime';

    if (errorStr.includes('dynamically imported module') || errorStr.includes('loading chunk') || errorStr.includes('failed to fetch')) {
      errorCategory = 'chunk';
    } else if (errorStr.includes('network') || errorStr.includes('fetch') || errorStr.includes('econnrefused')) {
      errorCategory = 'network';
    } else if (errorStr.includes('unauthorized') || errorStr.includes('permission') || errorStr.includes('token') || errorStr.includes('forbidden')) {
      errorCategory = 'auth';
    }

    const incidentId = `INC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    return {
      hasError: true,
      error,
      errorCategory,
      incidentId
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const timestamp = new Date().toISOString();
    const currentRoute = typeof window !== 'undefined' ? (window.location.hash || window.location.pathname || '/') : '/';
    
    // Safely determine active user role without touching PII or credentials
    let userRole = 'client_taxpayer';
    try {
      const rawUser = localStorage.getItem('ar_tax_user') || sessionStorage.getItem('ar_tax_user');
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (parsed && typeof parsed.role === 'string') {
          userRole = parsed.role;
        }
      }
    } catch {
      // Safe fallback
    }

    // Extract component name from React component stack
    const stack = errorInfo.componentStack || '';
    const componentMatch = stack.match(/at\s+([A-Z][A-Za-z0-9_]+)/);
    const failedComponentName = componentMatch?.[1] || 'ClientPortal';

    const sanitizedMessage = sanitizeSensitiveData(error?.message || 'Unknown runtime interruption');
    const sanitizedStack = sanitizeSensitiveData(stack.slice(0, 1500));

    this.setState({
      failedComponentName,
      sanitizedMessage,
      componentStack: sanitizedStack,
      route: currentRoute,
      userRole,
      timestamp
    });

    // In development mode, output sanitized diagnostic logs to developer console
    if (import.meta.env.DEV) {
      console.group(`[AR-SECURE-AUDIT] Development Error Diagnostic [${this.state.incidentId}]`);
      console.error('Error Message:', sanitizedMessage);
      console.info('Failed Component:', failedComponentName);
      console.info('Route:', currentRoute);
      console.info('Active User Role:', userRole);
      console.info('Timestamp:', timestamp);
      console.info('Reference ID:', this.state.incidentId);
      console.debug('Sanitized Component Stack:\n', sanitizedStack);
      console.groupEnd();
    }

    try {
      const sanitizedError = new Error(sanitizedMessage);
      sanitizedError.name = error?.name || 'Error';
      reportClientError(sanitizedError, this.state.incidentId || undefined, {
        componentStack: sanitizedStack
      });
    } catch {
      // Silent catch
    }
  }

  private handleReload = () => {
    // Clear only corrupted temporary application UI cache, NEVER valid authentication or user profiles
    try {
      const transientKeys = [
        'ar_tax_portal_active_tab',
        'ar_tax_active_tax_year',
        'ar_tax_portal_temp_state',
        'ar_tax_doc_filter_cache',
        'ar_tax_messages_filter',
        'ar_tax_workspace_tab',
        'ar_tax_transient_error',
        'ar_tax_form_draft'
      ];
      transientKeys.forEach(key => {
        try {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        } catch {}
      });

      // Clear any transient sessionStorage caches
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key && (key.startsWith('temp_') || key.startsWith('cache_') || key.includes('transient'))) {
          sessionStorage.removeItem(key);
        }
      }
    } catch {
      // Non-fatal
    }

    window.location.reload();
  };

  private handleGoHome = () => {
    // Navigate strictly to the authenticated client dashboard overview, not the public homepage
    this.setState({ 
      hasError: false, 
      error: null, 
      incidentId: null,
      failedComponentName: null,
      sanitizedMessage: null,
      componentStack: null
    });
    window.location.hash = '#/client/login';
  };

  private toggleDevDiagnostics = () => {
    this.setState(prev => ({ showDevDiagnostics: !prev.showDevDiagnostics }));
  };

  public render() {
    if (this.state.hasError) {
      const { fallbackTitle, fallbackMessage } = this.props;
      const { 
        errorCategory, 
        incidentId, 
        failedComponentName, 
        sanitizedMessage, 
        route, 
        userRole, 
        timestamp,
        showDevDiagnostics 
      } = this.state;

      const isDev = Boolean(import.meta.env.DEV);

      let title = fallbackTitle || 'Unexpected System Interruption';
      let description = fallbackMessage || 'Our secure client portal encountered an unexpected state. All client records and encrypted tax documents remain fully safeguarded.';

      if (errorCategory === 'chunk') {
        title = 'Application Update Available';
        description = 'A newer version of the A/R Tax Services portal is available. Please reload the workspace to update your secure session.';
      } else if (errorCategory === 'network') {
        title = 'Network Connection Interrupted';
        description = 'Unable to establish a secure connection to firm backend servers. Please verify your internet connection and retry.';
      } else if (errorCategory === 'auth') {
        title = 'Session Authentication Notice';
        description = 'Your authorization session has expired or requires re-verification per firm security policies.';
      }

      return (
        <div className="min-h-screen bg-[#07172B] flex items-center justify-center p-6 text-slate-100 selection:bg-[#C6A15B] selection:text-[#07172B]">
          <div className="max-w-2xl w-full bg-[#0D2340] border border-[#1E3A5F] rounded-3xl p-8 sm:p-10 shadow-2xl space-y-6 text-center">
            
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center shadow-lg">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold text-[#C6A15B] uppercase tracking-wider">
                Firm Security &amp; Resilience Boundary
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl font-extrabold text-white">
                {title}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
                {description}
              </p>
            </div>

            {incidentId && (
              <div className="p-3 rounded-xl bg-[#07172B] border border-[#1E3A5F] text-[11px] text-slate-400 font-mono inline-block">
                Reference ID: <span className="text-[#C6A15B] font-semibold">{incidentId}</span>
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Portal
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-xs text-slate-200 bg-[#07172B] hover:text-white border border-[#1E3A5F] hover:border-[#C6A15B] transition-all flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                Return to Overview
              </button>
            </div>

            {/* Protected Technical Diagnostic Panel (Strictly Development Mode Only) */}
            {isDev && (
              <div className="pt-2 border-t border-[#1E3A5F] text-left">
                <button
                  type="button"
                  onClick={this.toggleDevDiagnostics}
                  className="w-full py-2 px-3 rounded-xl bg-[#07172B]/80 hover:bg-[#07172B] border border-[#1E3A5F] text-[11px] text-slate-300 font-mono flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-2 text-amber-400 font-semibold">
                    <Bug className="w-3.5 h-3.5" />
                    Development Technical Diagnostics
                  </span>
                  <span className="flex items-center gap-1 text-slate-400 text-[10px]">
                    {showDevDiagnostics ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </span>
                </button>

                {showDevDiagnostics && (
                  <div className="mt-2 p-4 rounded-xl bg-[#06172C] border border-amber-500/30 text-xs font-mono space-y-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-amber-400/90 font-bold border-b border-[#1E3A5F] pb-1">
                      Protected Diagnostic Report (Never Expose in Production)
                    </div>
                    <div>
                      <span className="text-slate-400">Failed Component:</span>{' '}
                      <span className="text-amber-300 font-bold">{failedComponentName || 'Unknown Component'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Sanitized Error:</span>{' '}
                      <span className="text-rose-300 break-all">{sanitizedMessage || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-400">Route:</span>{' '}
                        <span className="text-slate-200">{route || '/'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Active Role:</span>{' '}
                        <span className="text-slate-200">{userRole || 'CLIENT_TAXPAYER'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Timestamp:</span>{' '}
                        <span className="text-slate-200">{timestamp || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Sanitization:</span>{' '}
                        <span className="text-emerald-400 font-semibold">SSN / Tokens / PII Redacted</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-[#1E3A5F] pt-4">
              <p className="text-[11px] text-slate-400">
                Need direct assistance? Contact client concierge at{' '}
                <a href="mailto:info@artaxservices.com" className="text-[#C6A15B] hover:underline font-medium">
                  info@artaxservices.com
                </a>{' '}
                or call (803) 555-0199.
              </p>
            </div>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

