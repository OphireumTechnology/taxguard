/**
 * A/R Tax Services, LLC - Accountant Admin, Team, AI Configuration & Practice Settings
 * Sections 14, 15, 16, 17, 18, 19, 20: Practice Management, Team, Roles, AI Thresholds, and Demo Environment.
 */

import React, { useState } from 'react';
import { 
  Users, 
  ShieldCheck, 
  Cpu, 
  FileCode, 
  Sliders, 
  RotateCcw, 
  Settings, 
  CheckCircle, 
  Lock,
  Globe2,
  Building2,
  AlertTriangle
} from 'lucide-react';
import { accountantCenterService } from '../../services/AccountantCenterService';

interface AccountantAdminViewsProps {
  viewId: string; // 'team' | 'roles' | 'ai_config' | 'doc_rules' | 'workflow' | 'demo_env' | 'settings'
  isDark: boolean;
}

export const AccountantAdminViews: React.FC<AccountantAdminViewsProps> = ({ viewId, isDark }) => {
  const [highConfidenceThreshold, setHighConfidenceThreshold] = useState(90);
  const [reviewConfidenceThreshold, setReviewConfidenceThreshold] = useState(75);
  const [demoNotice, setDemoNotice] = useState<string | null>(null);

  const cardBg = isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-300';
  const textPrimary = isDark ? 'text-white' : 'text-neutral-900';
  const textSecondary = isDark ? 'text-neutral-400' : 'text-neutral-600';

  const handleResetDemo = () => {
    accountantCenterService.resetDemoData();
    setDemoNotice('Demo state restored to original benchmark defaults.');
    setTimeout(() => setDemoNotice(null), 4000);
  };

  const handleSwitchClientScenario = (clientId: string) => {
    accountantCenterService.selectClient(clientId);
    setDemoNotice(`Switched active client scenario to ID: ${clientId}`);
    setTimeout(() => setDemoNotice(null), 4000);
  };

  return (
    <div className="space-y-6">
      {demoNotice && (
        <div className="p-3 bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-mono text-xs font-bold rounded flex items-center justify-between shadow">
          <span>{demoNotice}</span>
          <span>✓ Applied</span>
        </div>
      )}

      {/* 14. PRACTICE TEAM & WORKLOAD */}
      {viewId === 'team' && (
        <div className={`p-5 border rounded-lg shadow-sm ${cardBg} space-y-4`}>
          <div>
            <div className="text-[10px] font-mono uppercase bg-neutral-200/80 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 px-2 py-0.5 rounded inline-block font-bold mb-1">
              Section 14 &bull; Practice Capacity
            </div>
            <h2 className={`text-lg font-bold uppercase tracking-tight ${textPrimary}`}>
              Practice Staff &amp; Reviewer Workload Allocation
            </h2>
            <p className={`text-xs ${textSecondary} mt-0.5`}>
              Managing preparer assignments, reviewer capacity, and return due date SLAs.
            </p>
          </div>

          <div className="border rounded overflow-x-auto border-neutral-200 dark:border-neutral-800 text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-800/60 font-mono text-[10px] uppercase text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
                  <th className="p-3">Staff Member</th>
                  <th className="p-3">Professional Credential</th>
                  <th className="p-3">Active File Load</th>
                  <th className="p-3">Awaiting QC Review</th>
                  <th className="p-3">Signed Returns</th>
                  <th className="p-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-mono">
                <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                  <td className="p-3 font-bold text-neutral-900 dark:text-white">Marcus Vance</td>
                  <td className="p-3 text-neutral-600 dark:text-neutral-400">Enrolled Agent (EA)</td>
                  <td className="p-3 font-bold">14 Files</td>
                  <td className="p-3 text-amber-600 font-bold">3 Returns</td>
                  <td className="p-3 text-emerald-600 font-bold">28 Returns</td>
                  <td className="p-3 text-right"><span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">ACTIVE</span></td>
                </tr>
                <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                  <td className="p-3 font-bold text-neutral-900 dark:text-white">Sarah Jenkins</td>
                  <td className="p-3 text-neutral-600 dark:text-neutral-400">CPA (SC License #12948)</td>
                  <td className="p-3 font-bold">19 Files</td>
                  <td className="p-3 text-amber-600 font-bold">5 Returns</td>
                  <td className="p-3 text-emerald-600 font-bold">42 Returns</td>
                  <td className="p-3 text-right"><span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">ACTIVE</span></td>
                </tr>
                <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                  <td className="p-3 font-bold text-neutral-900 dark:text-white">David Henze</td>
                  <td className="p-3 text-neutral-600 dark:text-neutral-400">Managing Partner</td>
                  <td className="p-3 font-bold">6 Files</td>
                  <td className="p-3 text-amber-600 font-bold">1 Return</td>
                  <td className="p-3 text-emerald-600 font-bold">19 Returns</td>
                  <td className="p-3 text-right"><span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">ACTIVE</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 15. ROLES & PERMISSIONS */}
      {viewId === 'roles' && (
        <div className={`p-5 border rounded-lg shadow-sm ${cardBg} space-y-4`}>
          <div>
            <div className="text-[10px] font-mono uppercase bg-neutral-200/80 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 px-2 py-0.5 rounded inline-block font-bold mb-1">
              Section 15 &bull; Security &amp; Access Controls
            </div>
            <h2 className={`text-lg font-bold uppercase tracking-tight ${textPrimary}`}>
              Role-Based Access Control (RBAC) &amp; Privacy Boundary
            </h2>
            <p className={`text-xs ${textSecondary} mt-0.5`}>
              Enforcing internal privacy separation, client view scoping, and signing authority.
            </p>
          </div>

          <div className="p-3 border rounded border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-xs font-mono text-amber-900 dark:text-amber-200">
            <strong>CRITICAL PRIVACY GUARANTEE:</strong> Accountant Private Internal Notes are strictly restricted to staff roles (Admin, Accountant, Preparer) and are mathematically blocked from rendering in client portal queries.
          </div>

          <div className="border rounded overflow-x-auto border-neutral-200 dark:border-neutral-800 text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-800/60 font-mono text-[10px] uppercase text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
                  <th className="p-3">Role Designation</th>
                  <th className="p-3">Upload / Intake</th>
                  <th className="p-3">AI Override</th>
                  <th className="p-3">Private Notes</th>
                  <th className="p-3">Hard-Stop Waiver</th>
                  <th className="p-3">Final ERO Sign-off</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-mono">
                <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                  <td className="p-3 font-bold">Managing Partner / Admin</td>
                  <td className="p-3 text-emerald-600">✓ Full</td>
                  <td className="p-3 text-emerald-600">✓ Full</td>
                  <td className="p-3 text-emerald-600">✓ Full</td>
                  <td className="p-3 text-emerald-600">✓ Full</td>
                  <td className="p-3 text-emerald-600">✓ Authorized ERO</td>
                </tr>
                <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                  <td className="p-3 font-bold">Senior Accountant / EA / CPA</td>
                  <td className="p-3 text-emerald-600">✓ Full</td>
                  <td className="p-3 text-emerald-600">✓ Full</td>
                  <td className="p-3 text-emerald-600">✓ Full</td>
                  <td className="p-3 text-emerald-600">✓ Full</td>
                  <td className="p-3 text-emerald-600">✓ Authorized ERO</td>
                </tr>
                <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                  <td className="p-3 font-bold">Tax Preparer / Associate</td>
                  <td className="p-3 text-emerald-600">✓ Full</td>
                  <td className="p-3 text-emerald-600">✓ With Reason</td>
                  <td className="p-3 text-emerald-600">✓ View / Edit</td>
                  <td className="p-3 text-red-600">✕ Escalation Req</td>
                  <td className="p-3 text-red-600">✕ Senior Signer Req</td>
                </tr>
                <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                  <td className="p-3 font-bold text-neutral-500">Taxpayer / Client User</td>
                  <td className="p-3 text-emerald-600">✓ Client Files</td>
                  <td className="p-3 text-red-600">✕ Blocked</td>
                  <td className="p-3 text-red-600">✕ Strictly Hidden</td>
                  <td className="p-3 text-red-600">✕ Blocked</td>
                  <td className="p-3 text-emerald-600">✓ Form 8879 Only</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 16. AI CONFIGURATION */}
      {viewId === 'ai_config' && (
        <div className={`p-5 border rounded-lg shadow-sm ${cardBg} space-y-5`}>
          <div>
            <div className="text-[10px] font-mono uppercase bg-neutral-200/80 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 px-2 py-0.5 rounded inline-block font-bold mb-1">
              Section 16 &bull; Optical Intelligence &amp; AI Thresholds
            </div>
            <h2 className={`text-lg font-bold uppercase tracking-tight ${textPrimary}`}>
              AI Tax Extraction &amp; Confidence Model Calibration
            </h2>
            <p className={`text-xs ${textSecondary} mt-0.5`}>
              Tune classification and extraction confidence thresholds for automated workpaper population.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-4 border rounded space-y-2">
              <label className="font-bold text-neutral-900 dark:text-white block">
                High-Confidence Auto-Verification Threshold ({highConfidenceThreshold}%)
              </label>
              <input
                type="range"
                min={80}
                max={99}
                value={highConfidenceThreshold}
                onChange={e => setHighConfidenceThreshold(Number(e.target.value))}
                className="w-full"
              />
              <p className="text-[11px] text-neutral-500">
                Documents scoring &gt;={highConfidenceThreshold}% confidence bypass low-confidence queues and are staged directly for preparer approval.
              </p>
            </div>

            <div className="p-4 border rounded space-y-2">
              <label className="font-bold text-neutral-900 dark:text-white block">
                Manual Audit Required Threshold (&lt;{reviewConfidenceThreshold}%)
              </label>
              <input
                type="range"
                min={60}
                max={85}
                value={reviewConfidenceThreshold}
                onChange={e => setReviewConfidenceThreshold(Number(e.target.value))}
                className="w-full"
              />
              <p className="text-[11px] text-neutral-500">
                Documents scoring &lt;{reviewConfidenceThreshold}% trigger mandatory manual field-by-field OCR verification gates.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 17. DOCUMENT RULES */}
      {viewId === 'doc_rules' && (
        <div className={`p-5 border rounded-lg shadow-sm ${cardBg} space-y-4`}>
          <div>
            <div className="text-[10px] font-mono uppercase bg-neutral-200/80 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 px-2 py-0.5 rounded inline-block font-bold mb-1">
              Section 17 &bull; Intake Policy
            </div>
            <h2 className={`text-lg font-bold uppercase tracking-tight ${textPrimary}`}>
              Document Classification &amp; Retention Rules
            </h2>
            <p className={`text-xs ${textSecondary} mt-0.5`}>
              Statutory 7-year IRS tax record retention protocols and automated mismatch detection policies.
            </p>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="p-3 border rounded flex justify-between items-center">
              <div>
                <strong>Tax-Year Mismatch Tolerance:</strong> Strict (0-year tolerance; mismatch flagged immediately)
              </div>
              <span className="text-emerald-600 font-bold">ENFORCED</span>
            </div>
            <div className="p-3 border rounded flex justify-between items-center">
              <div>
                <strong>Duplicate Detection Strategy:</strong> Composite hash + EIN + Box 1 wage match
              </div>
              <span className="text-emerald-600 font-bold">ENFORCED</span>
            </div>
            <div className="p-3 border rounded flex justify-between items-center">
              <div>
                <strong>IRS Record Retention Period:</strong> 7 Years (Cloud Storage Archive)
              </div>
              <span className="text-emerald-600 font-bold">ACTIVE</span>
            </div>
          </div>
        </div>
      )}

      {/* 18. WORKFLOW CONFIGURATION */}
      {viewId === 'workflow' && (
        <div className={`p-5 border rounded-lg shadow-sm ${cardBg} space-y-4`}>
          <div>
            <div className="text-[10px] font-mono uppercase bg-neutral-200/80 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 px-2 py-0.5 rounded inline-block font-bold mb-1">
              Section 18 &bull; Gate Policy
            </div>
            <h2 className={`text-lg font-bold uppercase tracking-tight ${textPrimary}`}>
              Mandatory Gate &amp; Hard-Stop Enforcement Policy
            </h2>
            <p className={`text-xs ${textSecondary} mt-0.5`}>
              Firm configuration governing readiness blocking and senior partner override protocols.
            </p>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="p-3 border rounded flex justify-between items-center">
              <div>
                <strong>Foreign Account Hard-Stop (Gate 5):</strong> Cannot be bypassed without FBAR/8938 determination
              </div>
              <span className="text-red-600 font-bold">MANDATORY</span>
            </div>
            <div className="p-3 border rounded flex justify-between items-center">
              <div>
                <strong>High Priority Exceptions (Gate 6):</strong> All must be resolved or waived with reason
              </div>
              <span className="text-red-600 font-bold">MANDATORY</span>
            </div>
            <div className="p-3 border rounded flex justify-between items-center">
              <div>
                <strong>17-Stage QC Sign-off (Gate 10):</strong> 100% completion required for E-File button enablement
              </div>
              <span className="text-red-600 font-bold">MANDATORY</span>
            </div>
          </div>
        </div>
      )}

      {/* 19. DEMO ENVIRONMENT */}
      {viewId === 'demo_env' && (
        <div className={`p-5 border rounded-lg shadow-sm ${cardBg} space-y-4`}>
          <div>
            <div className="text-[10px] font-mono uppercase bg-neutral-200/80 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 px-2 py-0.5 rounded inline-block font-bold mb-1">
              Section 19 &bull; Sandbox Simulator
            </div>
            <h2 className={`text-lg font-bold uppercase tracking-tight ${textPrimary}`}>
              Demonstration Environment &amp; Client Scenario Switcher
            </h2>
            <p className={`text-xs ${textSecondary} mt-0.5`}>
              Switch between diverse client profiles (Simple Employee, Small Business Owner, High Net Worth Investor, Foreign Asset Holder).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
            <button
              onClick={() => handleSwitchClientScenario('client-1')}
              className="p-3 border rounded text-left hover:border-black dark:hover:border-white transition-colors"
            >
              <div className="font-bold text-neutral-900 dark:text-white">Client A &bull; Comprehensive Demo</div>
              <div className="text-[10px] text-neutral-500">Alex &amp; Taylor Morgan (W-2, Consulting, Rental, Foreign ZKB)</div>
            </button>

            <button
              onClick={() => handleSwitchClientScenario('client-2')}
              className="p-3 border rounded text-left hover:border-black dark:hover:border-white transition-colors"
            >
              <div className="font-bold text-neutral-900 dark:text-white">Client B &bull; Summit Peak Capital</div>
              <div className="text-[10px] text-neutral-500">Corporate Partnership &amp; High-Volume K-1 Investor</div>
            </button>

            <button
              onClick={() => handleSwitchClientScenario('client-3')}
              className="p-3 border rounded text-left hover:border-black dark:hover:border-white transition-colors"
            >
              <div className="font-bold text-neutral-900 dark:text-white">Client C &bull; Perotti Italian Imports</div>
              <div className="text-[10px] text-neutral-500">Multi-State Commercial S-Corp &amp; Payroll WH</div>
            </button>
          </div>

          <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
            <button
              onClick={handleResetDemo}
              className="px-4 py-2 bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900 rounded text-xs font-bold uppercase hover:opacity-90 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Demo Sandbox State</span>
            </button>
          </div>
        </div>
      )}

      {/* 20. SYSTEM SETTINGS */}
      {viewId === 'settings' && (
        <div className={`p-5 border rounded-lg shadow-sm ${cardBg} space-y-4`}>
          <div>
            <div className="text-[10px] font-mono uppercase bg-neutral-200/80 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 px-2 py-0.5 rounded inline-block font-bold mb-1">
              Section 20 &bull; Firm Credentials
            </div>
            <h2 className={`text-lg font-bold uppercase tracking-tight ${textPrimary}`}>
              Firm Licensing, EFIN &amp; Electronic Transmitter Settings
            </h2>
            <p className={`text-xs ${textSecondary} mt-0.5`}>
              A/R Tax Services, LLC practice registration credentials.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-3 border rounded space-y-1">
              <span className="text-[10px] text-neutral-500 uppercase block">Firm Legal Name</span>
              <strong className="text-neutral-900 dark:text-white">A/R Tax Services, LLC</strong>
            </div>
            <div className="p-3 border rounded space-y-1">
              <span className="text-[10px] text-neutral-500 uppercase block">Firm Address</span>
              <strong className="text-neutral-900 dark:text-white">1224 Pickens St, Columbia, SC 29201</strong>
            </div>
            <div className="p-3 border rounded space-y-1">
              <span className="text-[10px] text-neutral-500 uppercase block">IRS Electronic Filing ID (EFIN)</span>
              <strong className="text-neutral-900 dark:text-white">574892 (Active Authorized ERO)</strong>
            </div>
            <div className="p-3 border rounded space-y-1">
              <span className="text-[10px] text-neutral-500 uppercase block">Authorized Signer PTIN</span>
              <strong className="text-neutral-900 dark:text-white">P01849201 (Marcus Vance, EA)</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
