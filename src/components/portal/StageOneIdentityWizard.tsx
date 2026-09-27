/**
 * A/R Tax Services, LLC - Stage One Identity Verification Wizard
 * Entry point: Registration -> Stage One Onboard (Unified 18-Stage Operating Workflow)
 * Features:
 * - Internal Client ID tracking
 * - Taxpayer type & entity classification
 * - Secure TIN masking (never expose full TINs)
 * - Address & authorized representative collection
 * - Supporting ID documents via secure upload
 * - 5-Point Duplicate Check (TIN, Name, Email, Phone, Address) with blocking & review routing
 * - Approved IRC Â§ 7216 engagement & consent
 * - Onboarding Readiness Card & Hard Exit Gate
 * - Stage Two activation upon pass
 */

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  User, 
  Building2, 
  Lock, 
  MapPin, 
  FileText, 
  UploadCloud, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  ArrowLeft, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Clock, 
  FileCheck, 
  HelpCircle, 
  ExternalLink,
  Layers,
  Sparkles,
  Sliders,
  Check
} from 'lucide-react';
import { 
  StageOneOnboardingService, 
  StageOneDossier, 
  TaxpayerType, 
  EntityClassification,
  SupportingIdDoc,
  DuplicateCheckReport
} from '../../services/stageOneOnboardingService';
import { DocumentUpload } from './DocumentUpload';
import { EnvironmentConfigService, AppEnvironment } from '../../config/environmentConfig';
import { useApp } from '../../context/AppContext';
import { INITIAL_DEMO_CLIENTS } from '../../demo/mockData';

interface StageOneIdentityWizardProps {
  initialClientId?: string;
  onExitGatePassed?: () => void;
  onNavigateToDashboard?: () => void;
}

export const StageOneIdentityWizard: React.FC<StageOneIdentityWizardProps> = ({
  initialClientId,
  onExitGatePassed,
  onNavigateToDashboard
}) => {
  const { currentUser, setCurrentPage } = useApp();

  /*
   * HARD ENVIRONMENT BOUNDARY
   *
   * A normal authenticated client is LIVE.
   * artest2026 remains the demonstration account.
   */
  const isLiveClient =
    currentUser?.role === 'client' &&
    Boolean(currentUser?.id) &&
    Boolean(currentUser?.email) &&
    currentUser.email.toLowerCase() !== 'artest2026';

  const authenticatedClientId = currentUser?.clientId;
  
  // Environment state
  const [activeEnv, setActiveEnv] = useState<AppEnvironment>(() => EnvironmentConfigService.getEnvironment());
  const envConfig = EnvironmentConfigService.getConfig();

  // Active client dossier state
  const [dossier, setDossier] = useState<StageOneDossier | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'tin' | 'addresses' | 'representative' | 'documents' | 'duplicate' | 'consent' | 'readiness'>('profile');
  
  // Raw TIN input state (masked immediately, never stored raw)
  const [rawTinInput, setRawTinInput] = useState('');
  const [tinNotice, setTinNotice] = useState<string | null>(null);

  // Failure path / testing simulation state
  const [isSimulatingCheck, setIsSimulatingCheck] = useState(false);
  const [gateErrorMessage, setGateErrorMessage] = useState<string | null>(null);
  const [gateSuccessMessage, setGateSuccessMessage] = useState<string | null>(null);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  // Reviewer role simulation toggle for duplicate overrides
  const [isReviewerMode, setIsReviewerMode] = useState(false);
  const [reviewOverrideNotes, setReviewOverrideNotes] = useState('');

  // Initialize or load dossier
  useEffect(() => {
    setInitializationError(null);

    /*
     * LIVE must NEVER inherit the browser's previously active
     * demonstration/onboarding client.
     *
     * DEMO preserves the existing fallback behavior.
     */
    const targetId =
      isLiveClient
        ? authenticatedClientId
        : (
            initialClientId ||
            StageOneOnboardingService.getActiveClientId() ||
            'AR-CLT-2025-10842'
          );

    if (!targetId) {
      if (isLiveClient) {
        setDossier(null);
        setInitializationError('Permanent TaxGuard Client ID is unavailable. Stage 01 cannot initialize until the authenticated LIVE identity is restored.');
      }
      return;
    }

    if (isLiveClient) {
      StageOneOnboardingService.setActiveClientId(targetId);
    }
    let loaded = StageOneOnboardingService.getDossier(targetId);
    
    if (!loaded) {
      // Create initial dossier if none exists
      loaded = StageOneOnboardingService.createInitialDossier({
        /*
         * LIVE identity is assigned by authentication/provisioning.
         * Never replace it with a random Stage One identifier.
         */
        clientId:
          isLiveClient
            ? targetId
            : undefined,

        fullName:
          currentUser?.name ||
          (isLiveClient ? '' : 'Vance Global Enterprises, LLC'),
        email:
          currentUser?.email ||
          (isLiveClient ? '' : 'eleanor.vance@example.com'),
        phone:
          currentUser?.phone ||
          (isLiveClient ? '' : '(678) 555-0199'),
        taxpayerType:
          isLiveClient
            ? (currentUser?.companyName || currentUser?.company ? 'entity' : 'individual')
            : 'entity',
        businessName:
          currentUser?.companyName ||
          currentUser?.company ||
          (isLiveClient ? '' : 'Vance Global Enterprises, LLC')
      });
    }

    setDossier(loaded);
  }, [initialClientId, currentUser]);

  const updateDossier = (updated: StageOneDossier) => {
    StageOneOnboardingService.saveDossier(updated);
    setDossier({ ...updated });
  };

  const handleEnvChange = (env: AppEnvironment) => {
    /*
     * Environment switching is a demonstration/testing capability.
     * A LIVE client cannot change application environment.
     */
    if (isLiveClient) {
      return;
    }

    EnvironmentConfigService.setEnvironment(env);
    setActiveEnv(env);
  };

  // Safe TIN submission
  const handleSaveTIN = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dossier) return;
    const cleaned = rawTinInput.replace(/\D/g, '');
    if (cleaned.length !== 9) {
      setTinNotice('Taxpayer Identification Number must contain exactly 9 numeric digits.');
      return;
    }

    const { masked, last4 } = StageOneOnboardingService.maskTIN(cleaned, dossier.tinType);
    const updated: StageOneDossier = {
      ...dossier,
      maskedTIN: masked,
      tinLast4: last4
    };
    updateDossier(updated);
    setRawTinInput('');
    setTinNotice('TIN securely formatted and stored in masked representation. Full digits zeroized.');
  };

  // Run duplicate check
  const handleRunDuplicateCheck = () => {
    if (!dossier) return;
    setIsSimulatingCheck(true);
    setTimeout(() => {
      const report =
        StageOneOnboardingService.runDuplicateCheck(
          dossier,
          {
            includeDemoRepository: !isLiveClient
          }
        );
      const updated: StageOneDossier = {
        ...dossier,
        duplicateCheck: report
      };
      updateDossier(updated);
      setIsSimulatingCheck(false);
    }, 400);
  };

  // Document upload completion handler
  const handleDocUploadComplete = (metadata: any) => {
    if (!dossier) return;
    if (typeof metadata.sha256Hash !== 'string' || !/^[a-f0-9]{64}$/i.test(metadata.sha256Hash)) {
      throw new Error('Supporting document provenance is incomplete: a valid SHA-256 source hash is required.');
    }
    const newDoc: SupportingIdDoc = {
      id: metadata.id || `doc_${Date.now()}`,
      name: metadata.fileName || 'Government_ID_Verification.pdf',
      category: 'government_id',
      sha256Hash: metadata.sha256Hash,
      uploadedAt: new Date().toISOString(),
      fileSize: metadata.fileSize || '2.4 MB',
      verified: metadata.malwareScanStatus === 'clean'
    };
    const updated: StageOneDossier = {
      ...dossier,
      supportingDocs: [...(dossier.supportingDocs || []), newDoc]
    };
    updateDossier(updated);
  };

  // Hard Exit Gate Submission
  const handleAttemptExitGate = () => {
    if (!dossier) return;
    setGateErrorMessage(null);
    setGateSuccessMessage(null);

    const result = StageOneOnboardingService.passHardExitGate(dossier.clientId);
    if (!result.success) {
      setGateErrorMessage(result.error || 'Hard Exit Gate Locked: Requirements unsatisfied.');
      return;
    }

    if (result.dossier) {
      setDossier(result.dossier);
      setGateSuccessMessage('Stage One Passed! Unified 18-Stage Operating Cycle advanced to Stage Two (Collect). Normal Client Dashboard is now active.');
      if (onExitGatePassed) {
        onExitGatePassed();
      }
    }
  };

  // Test Failure Simulation: Inject collision with an existing client
  const handleInjectCollision = (sampleExisting: typeof INITIAL_DEMO_CLIENTS[0]) => {
    if (isLiveClient) return;
    if (!dossier) return;
    const updated: StageOneDossier = {
      ...dossier,
      legalName: sampleExisting.name,
      dbaName: sampleExisting.businessName,
      email: sampleExisting.email,
      phone: sampleExisting.phone,
      tinLast4: sampleExisting.einOrSsnMasked.slice(-4),
      maskedTIN: sampleExisting.einOrSsnMasked
    };
    updateDossier(updated);
    setTimeout(() => {
      const report = StageOneOnboardingService.runDuplicateCheck(updated);
      updateDossier({ ...updated, duplicateCheck: report });
    }, 100);
  };

  // Test Happy Path: Autofill compliant data
  const handleAutofillCompliant = () => {
    if (isLiveClient) return;
    if (!dossier) return;
    const updated: StageOneDossier = {
      ...dossier,
      legalName: 'Palmetto Peak Ventures LLC',
      dbaName: 'Palmetto Peak Ventures',
      taxpayerType: 'entity',
      entityClassification: 'llc',
      tinType: 'ein',
      maskedTIN: 'XX-XXX8842',
      tinLast4: '8842',
      residentialOrPrincipalAddress: {
        street: '1201 Main Street, Suite 1500',
        city: 'Columbia',
        state: 'SC',
        zip: '29201',
        country: 'United States'
      },
      mailingAddress: {
        street: '1201 Main Street, Suite 1500',
        city: 'Columbia',
        state: 'SC',
        zip: '29201',
        country: 'United States'
      },
      mailingSameAsResidential: true,
      authorizedRep: {
        fullName: 'Eleanor Vance',
        title: 'Managing Member & Majority Owner',
        email: 'eleanor.vance@palmetto-demo.com',
        phone: '(803) 777-4411',
        relationshipOrCapacity: 'Authorized Member-Manager',
        hasPowerOfAttorney: true
      },
      supportingDocs: [
        {
          id: 'doc_auto_id_01',
          name: 'SC_Articles_of_Organization_PalmettoPeak.pdf',
          category: 'articles_of_org',
          sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          uploadedAt: new Date().toISOString(),
          fileSize: '1.8 MB',
          verified: true
        }
      ],
      duplicateCheck: {
        timestamp: new Date().toISOString(),
        status: 'CLEARED',
        matches: [],
        routedToReview: false
      },
      engagementConsent: {
        irc7216ConsentAccepted: true,
        termsAndScopeAccepted: true,
        pricingScheduleAcknowledged: true,
        electronicSignatureConsentAccepted: true,
        signerFullName: 'Eleanor Vance',
        signedAt: new Date().toISOString(),
        ipAddress: '192.168.1.42 (Encrypted Portal)',
        consentVersion: '2025.1-IRC7216'
      }
    };
    updateDossier(updated);
  };

  if (initializationError) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-rose-200 bg-rose-950/40 border border-rose-500/50 rounded-2xl">
        <AlertTriangle className="w-7 h-7 mx-auto mb-3 text-rose-400" />
        <div className="font-bold text-white">Stage One Initialization Blocked</div>
        <p className="text-xs mt-2">{initializationError}</p>
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="p-12 text-center text-slate-300">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-[#C6A15B]" />
        <span>Initializing Stage One Onboarding Dossier...</span>
      </div>
    );
  }

  const readiness = dossier.readiness;
  const isStageOneCompleted = dossier.stageOneCompleted;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 text-slate-100">
      
      {/* Top Banner: Workflow Header & Client ID */}
      <div className="rounded-3xl bg-[#0D2340] border border-[#1E3A5F] p-6 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1E3A5F] pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#C6A15B]/20 text-[#C6A15B] border border-[#C6A15B]/40">
                UNIFIED 18-STAGE OPERATING WORKFLOW
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-900/40 text-blue-300 border border-blue-500/30">
                STAGE 01: ONBOARD
              </span>
              {isStageOneCompleted ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-900/40 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>EXIT GATE PASSED â€” STAGE 02 (COLLECT) ACTIVE</span>
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-900/40 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>HARD EXIT GATE ACTIVE (READINESS: {readiness.completionPercentage}%)</span>
                </span>
              )}
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
              <span>Identity Verification Wizard</span>
            </h1>
            <p className="text-xs text-slate-300 mt-0.5">
              Authoritative client onboarding, taxpayer validation, TIN masking, duplicate detection, and IRC Â§ 7216 consent.
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-2 text-right">
            <div className="flex items-center gap-2 bg-[#07172B] px-3 py-1.5 rounded-xl border border-[#1E3A5F]">
              <span className="text-[10px] text-slate-400 font-mono uppercase">Internal Client ID:</span>
              <span className="text-xs font-mono font-bold text-[#C6A15B] tracking-wider">{dossier.clientId}</span>
            </div>
            
            {/* Environment boundary */}
            {isLiveClient ? (
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-slate-400">Environment:</span>

                <span className="px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                  LIVE CLIENT WORKSPACE
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[11px]">
                <span className="text-slate-400">Environment:</span>

                <select
                  value={activeEnv}
                  onChange={(e) =>
                    handleEnvChange(
                      e.target.value as AppEnvironment
                    )
                  }
                  className="bg-[#07172B] border border-[#1E3A5F] rounded-lg px-2 py-0.5 text-xs text-[#C6A15B] font-semibold focus:outline-none"
                >
                  <option value="demo">
                    Demo Mode (Fictional Data)
                  </option>

                  <option value="uat_staging">
                    UAT Staging Mode
                  </option>

                  <option value="production">
                    Production (Dual Key)
                  </option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Workflow Stage Map */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-xs">
          <div className={`p-2.5 rounded-xl border ${dossier.stageOneCompleted ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-[#C6A15B]/10 border-[#C6A15B]/40 text-[#C6A15B]'}`}>
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span>STAGE 01</span>
              {dossier.stageOneCompleted ? <Check className="w-3 h-3 text-emerald-400" /> : <span className="w-2 h-2 rounded-full bg-[#C6A15B] animate-pulse" />}
            </div>
            <div className="font-bold text-xs mt-0.5">Onboard (Identity Wizard)</div>
            <div className="text-[10px] text-slate-400">Exit Gate {dossier.stageOneCompleted ? 'Passed' : 'Pending'}</div>
          </div>

          <div className={`p-2.5 rounded-xl border ${dossier.activeWorkflowStage >= 2 ? 'bg-blue-950/40 border-blue-500/40 text-blue-300' : 'bg-[#07172B]/60 border-[#1E3A5F] text-slate-500'}`}>
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span>STAGE 02</span>
              {dossier.activeWorkflowStage >= 2 && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
            </div>
            <div className="font-bold text-xs mt-0.5">Collect (Intake & Vault)</div>
            <div className="text-[10px] text-slate-400">{dossier.activeWorkflowStage >= 2 ? 'Active Stage' : 'Locked'}</div>
          </div>

          <div className="p-2.5 rounded-xl border bg-[#07172B]/40 border-[#1E3A5F]/50 text-slate-500">
            <div className="text-[10px] font-mono">STAGE 03</div>
            <div className="font-bold text-xs mt-0.5">Validate</div>
            <div className="text-[10px] text-slate-500">Scheduled</div>
          </div>

          <div className="p-2.5 rounded-xl border bg-[#07172B]/40 border-[#1E3A5F]/50 text-slate-500">
            <div className="text-[10px] font-mono">STAGE 04</div>
            <div className="font-bold text-xs mt-0.5">Record</div>
            <div className="text-[10px] text-slate-500">Scheduled</div>
          </div>

          <div className="p-2.5 rounded-xl border bg-[#07172B]/40 border-[#1E3A5F]/50 text-slate-500 hidden md:block">
            <div className="text-[10px] font-mono">STAGE 05</div>
            <div className="font-bold text-xs mt-0.5">Reconcile</div>
            <div className="text-[10px] text-slate-500">Scheduled</div>
          </div>

          <div className="p-2.5 rounded-xl border bg-[#07172B]/40 border-[#1E3A5F]/50 text-slate-500 hidden md:block">
            <div className="text-[10px] font-mono">STAGE 06-18</div>
            <div className="font-bold text-xs mt-0.5">Review â†’ File â†’ Archive</div>
            <div className="text-[10px] text-slate-500">Unified 18-Stage</div>
          </div>
        </div>
      </div>

      {/* Success Banner when Stage One is Passed */}
      {isStageOneCompleted && (
        <div className="p-5 rounded-2xl bg-emerald-950/60 border border-emerald-500/60 text-emerald-200 flex flex-wrap items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
            <div>
              <div className="font-bold text-sm text-white">Stage One Onboard Complete & Exit Gate Unlocked!</div>
              <div className="text-xs text-emerald-300">
                All 7 blocking onboarding requirements are satisfied. Stage Two (Collect) is now activated in your 18-stage tax operating cycle.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (onNavigateToDashboard) {
                  onNavigateToDashboard();
                } else {
                  setCurrentPage('client_portal');
                }
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition-all flex items-center gap-1.5 shadow-lg"
            >
              <span>Open Client Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Testing Simulation Bar - DEMO ONLY */}
      {!isLiveClient && (
      <div className="p-3 rounded-2xl bg-[#07172B] border border-[#1E3A5F] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-semibold">
          <Sliders className="w-4 h-4 text-[#C6A15B]" />
          <span>Stage 1 Test Controls:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleAutofillCompliant}
            className="px-2.5 py-1 rounded-lg bg-[#1E3A5F] hover:bg-[#2A4D7A] text-slate-200 text-[11px] font-semibold transition-colors"
          >
            Autofill Valid Profile (Happy Path)
          </button>
          <button
            onClick={() => handleInjectCollision(INITIAL_DEMO_CLIENTS[0])}
            className="px-2.5 py-1 rounded-lg bg-amber-900/40 hover:bg-amber-900/60 text-amber-200 border border-amber-500/30 text-[11px] font-semibold transition-colors"
          >
            Simulate Duplicate Collision (Failure Path)
          </button>
          <button
            onClick={() => {
              // Clear documents to test missing document gate
              updateDossier({ ...dossier, supportingDocs: [] });
            }}
            className="px-2.5 py-1 rounded-lg bg-red-900/40 hover:bg-red-900/60 text-red-200 border border-red-500/30 text-[11px] font-semibold transition-colors"
          >
            Clear ID Docs (Test Gate Lock)
          </button>
          <button
            onClick={() => setIsReviewerMode(!isReviewerMode)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
              isReviewerMode ? 'bg-purple-900/50 text-purple-200 border border-purple-400' : 'bg-[#0D2340] text-slate-400 border border-[#1E3A5F]'
            }`}
          >
            {isReviewerMode ? 'Reviewer Role Active' : 'Enable Reviewer Role'}
          </button>
        </div>
      </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-[#1E3A5F] pb-2 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
            activeTab === 'profile' ? 'bg-[#C6A15B] text-[#07172B] font-bold shadow-md' : 'bg-[#0D2340] text-slate-300 hover:text-white'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>1. Taxpayer & Entity</span>
        </button>

        <button
          onClick={() => setActiveTab('tin')}
          className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
            activeTab === 'tin' ? 'bg-[#C6A15B] text-[#07172B] font-bold shadow-md' : 'bg-[#0D2340] text-slate-300 hover:text-white'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>2. Secure Masked TIN</span>
          {dossier.tinLast4 && dossier.tinLast4 !== '0000' && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-0.5" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('addresses')}
          className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
            activeTab === 'addresses' ? 'bg-[#C6A15B] text-[#07172B] font-bold shadow-md' : 'bg-[#0D2340] text-slate-300 hover:text-white'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>3. Addresses</span>
        </button>

        <button
          onClick={() => setActiveTab('representative')}
          className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
            activeTab === 'representative' ? 'bg-[#C6A15B] text-[#07172B] font-bold shadow-md' : 'bg-[#0D2340] text-slate-300 hover:text-white'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>4. Authorized Rep</span>
        </button>

        <button
          onClick={() => setActiveTab('documents')}
          className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
            activeTab === 'documents' ? 'bg-[#C6A15B] text-[#07172B] font-bold shadow-md' : 'bg-[#0D2340] text-slate-300 hover:text-white'
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>5. Supporting ID</span>
          {dossier.supportingDocs && dossier.supportingDocs.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-900 text-emerald-300 text-[10px] font-mono font-bold">
              {dossier.supportingDocs.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('duplicate')}
          className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
            activeTab === 'duplicate' ? 'bg-[#C6A15B] text-[#07172B] font-bold shadow-md' : 'bg-[#0D2340] text-slate-300 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>6. Duplicate Check</span>
          {dossier.duplicateCheck.status !== 'CLEARED' && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-900 text-amber-300 text-[10px] font-mono font-bold">
              !
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('consent')}
          className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
            activeTab === 'consent' ? 'bg-[#C6A15B] text-[#07172B] font-bold shadow-md' : 'bg-[#0D2340] text-slate-300 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>7. IRC Â§ 7216 Consent</span>
        </button>

        <button
          onClick={() => setActiveTab('readiness')}
          className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
            activeTab === 'readiness' ? 'bg-amber-400 text-slate-900 font-bold shadow-md' : 'bg-amber-950/40 text-amber-300 hover:bg-amber-900/50'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>8. Readiness & Exit Gate</span>
          <span className="font-mono text-[10px] bg-black/40 px-1.5 py-0.5 rounded">
            {readiness.completionPercentage}%
          </span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="p-6 rounded-3xl bg-[#0D2340] border border-[#1E3A5F] shadow-xl">
        
        {/* TAB 1: TAXPAYER & LEGAL ENTITY */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="border-b border-[#1E3A5F] pb-3">
              <h2 className="font-serif text-lg font-bold text-white">1. Taxpayer Type & Legal Entity Profile</h2>
              <p className="text-xs text-slate-300">
                Identify whether filing as an individual taxpayer household or a formal legal commercial entity.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div
                onClick={() => updateDossier({ ...dossier, taxpayerType: 'individual', tinType: 'ssn' })}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  dossier.taxpayerType === 'individual' 
                    ? 'bg-[#07172B] border-[#C6A15B] shadow-lg ring-1 ring-[#C6A15B]' 
                    : 'bg-[#07172B]/60 border-[#1E3A5F] hover:border-slate-500'
                }`}
              >
                <div className="flex items-center gap-2 mb-2 font-bold text-sm text-white">
                  <User className="w-4 h-4 text-[#C6A15B]" />
                  <span>Individual / Household (Form 1040)</span>
                </div>
                <p className="text-slate-300 text-xs">
                  For individual wages, schedule C sole proprietorships, investments, rental real estate, and family tax returns.
                </p>
              </div>

              <div
                onClick={() => updateDossier({ ...dossier, taxpayerType: 'entity', tinType: 'ein' })}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  dossier.taxpayerType === 'entity' 
                    ? 'bg-[#07172B] border-[#C6A15B] shadow-lg ring-1 ring-[#C6A15B]' 
                    : 'bg-[#07172B]/60 border-[#1E3A5F] hover:border-slate-500'
                }`}
              >
                <div className="flex items-center gap-2 mb-2 font-bold text-sm text-white">
                  <Building2 className="w-4 h-4 text-[#C6A15B]" />
                  <span>Commercial Entity / Corporation / LLC</span>
                </div>
                <p className="text-slate-300 text-xs">
                  For registered corporations, partnerships, limited liability companies, and fiduciary estates requiring federal Form 1120/1120-S/1065.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Legal Full Name / Primary Taxpayer *</label>
                <input
                  type="text"
                  value={dossier.legalName}
                  onChange={(e) => updateDossier({ ...dossier, legalName: e.target.value })}
                  placeholder="e.g. Vance Global Enterprises, LLC or Eleanor Vance"
                  className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
                />
              </div>

              {dossier.taxpayerType === 'entity' ? (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Entity Classification *</label>
                  <select
                    value={dossier.entityClassification || 'llc'}
                    onChange={(e) => updateDossier({ ...dossier, entityClassification: e.target.value as EntityClassification })}
                    className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
                  >
                    <option value="llc">Limited Liability Company (LLC)</option>
                    <option value="scorp">S-Corporation (Form 1120-S)</option>
                    <option value="ccorp">C-Corporation (Form 1120)</option>
                    <option value="partnership">General or Limited Partnership (Form 1065)</option>
                    <option value="sole_prop">Sole Proprietorship / Single-Member LLC</option>
                    <option value="nonprofit">Tax-Exempt Nonprofit (Form 990)</option>
                    <option value="trust_estate">Fiduciary Estate or Trust (Form 1041)</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Doing Business As (DBA) / Trade Name (Optional)</label>
                  <input
                    type="text"
                    value={dossier.dbaName || ''}
                    onChange={(e) => updateDossier({ ...dossier, dbaName: e.target.value })}
                    placeholder="e.g. Vance Consulting Group"
                    className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Primary Email Address *</label>
                <input
                  type="email"
                  value={dossier.email}
                  onChange={(e) => updateDossier({ ...dossier, email: e.target.value })}
                  placeholder="contact@example.com"
                  className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Primary Telephone *</label>
                <input
                  type="tel"
                  value={dossier.phone}
                  onChange={(e) => updateDossier({ ...dossier, phone: e.target.value })}
                  placeholder="(803) 555-0100"
                  className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setActiveTab('tin')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition-all flex items-center gap-1.5"
              >
                <span>Continue to Secure TIN Verification</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: SECURE MASKED TIN */}
        {activeTab === 'tin' && (
          <div className="space-y-6">
            <div className="border-b border-[#1E3A5F] pb-3">
              <h2 className="font-serif text-lg font-bold text-white">2. Secure Taxpayer Identification Number (TIN)</h2>
              <p className="text-xs text-slate-300">
                IRS Circular 230 and Section 7216 compliant masked submission. Full TINs are never exposed in clear text.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#07172B] border border-[#1E3A5F] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Active Masked Identifier</span>
                  <div className="text-lg font-mono font-bold text-[#C6A15B] tracking-wider">
                    {dossier.maskedTIN || (dossier.tinType === 'ein' ? 'XX-XXX0000' : '***-**-0000')}
                  </div>
                </div>
                <div className="px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Role-Based Masking Active</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                To prevent identity theft, only authorized masked representations with the last 4 digits are stored in portal session state.
              </p>
            </div>

            <form onSubmit={handleSaveTIN} className="space-y-4 text-xs max-w-lg">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Identifier Type</label>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="tinType"
                      value="ein"
                      checked={dossier.tinType === 'ein'}
                      onChange={() => updateDossier({ ...dossier, tinType: 'ein' })}
                      className="text-[#C6A15B] focus:ring-[#C6A15B]"
                    />
                    <span>Employer Identification Number (EIN)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="tinType"
                      value="ssn"
                      checked={dossier.tinType === 'ssn'}
                      onChange={() => updateDossier({ ...dossier, tinType: 'ssn' })}
                      className="text-[#C6A15B] focus:ring-[#C6A15B]"
                    />
                    <span>Social Security Number (SSN / ITIN)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Enter 9-Digit Number (Will be instantly formatted and masked)
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    maxLength={11}
                    value={rawTinInput}
                    onChange={(e) => setRawTinInput(e.target.value)}
                    placeholder="9 numeric digits"
                    className="flex-1 bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-[#C6A15B]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition-all"
                  >
                    Format & Secure
                  </button>
                </div>
                {tinNotice && (
                  <p className="text-[11px] text-emerald-400 mt-1.5 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>{tinNotice}</span>
                  </p>
                )}
              </div>
            </form>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1E3A5F] hover:bg-[#2A4D7A] text-white flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('addresses')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] flex items-center gap-1.5"
              >
                <span>Next: Addresses & Nexus</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: ADDRESSES */}
        {activeTab === 'addresses' && (
          <div className="space-y-6">
            <div className="border-b border-[#1E3A5F] pb-3">
              <h2 className="font-serif text-lg font-bold text-white">3. Addresses & Tax Nexus</h2>
              <p className="text-xs text-slate-300">
                Provide legal physical domicile and mailing destination for formal tax notices.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <h3 className="font-bold text-white text-xs uppercase tracking-wider text-[#C6A15B]">
                Physical / Principal Street Address *
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1">Street Address</label>
                  <input
                    type="text"
                    value={dossier.residentialOrPrincipalAddress?.street || ''}
                    onChange={(e) => updateDossier({
                      ...dossier,
                      residentialOrPrincipalAddress: {
                        ...dossier.residentialOrPrincipalAddress,
                        street: e.target.value
                      }
                    })}
                    placeholder="1201 Main Street"
                    className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Suite / Unit</label>
                  <input
                    type="text"
                    value={dossier.residentialOrPrincipalAddress?.unit || ''}
                    onChange={(e) => updateDossier({
                      ...dossier,
                      residentialOrPrincipalAddress: {
                        ...dossier.residentialOrPrincipalAddress,
                        unit: e.target.value
                      }
                    })}
                    placeholder="Suite 1500"
                    className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">City</label>
                  <input
                    type="text"
                    value={dossier.residentialOrPrincipalAddress?.city || ''}
                    onChange={(e) => updateDossier({
                      ...dossier,
                      residentialOrPrincipalAddress: {
                        ...dossier.residentialOrPrincipalAddress,
                        city: e.target.value
                      }
                    })}
                    placeholder="Columbia"
                    className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">State Jurisdiction</label>
                  <input
                    type="text"
                    value={dossier.residentialOrPrincipalAddress?.state || 'SC'}
                    onChange={(e) => updateDossier({
                      ...dossier,
                      residentialOrPrincipalAddress: {
                        ...dossier.residentialOrPrincipalAddress,
                        state: e.target.value
                      }
                    })}
                    placeholder="SC"
                    className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Postal ZIP Code</label>
                  <input
                    type="text"
                    value={dossier.residentialOrPrincipalAddress?.zip || ''}
                    onChange={(e) => updateDossier({
                      ...dossier,
                      residentialOrPrincipalAddress: {
                        ...dossier.residentialOrPrincipalAddress,
                        zip: e.target.value
                      }
                    })}
                    placeholder="29201"
                    className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={dossier.mailingSameAsResidential}
                    onChange={(e) => updateDossier({
                      ...dossier,
                      mailingSameAsResidential: e.target.checked,
                      mailingAddress: e.target.checked ? dossier.residentialOrPrincipalAddress : dossier.mailingAddress
                    })}
                    className="rounded text-[#C6A15B] focus:ring-[#C6A15B]"
                  />
                  <span>Mailing address is identical to physical principal address</span>
                </label>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setActiveTab('tin')}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1E3A5F] hover:bg-[#2A4D7A] text-white flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('representative')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] flex items-center gap-1.5"
              >
                <span>Next: Authorized Representative</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: AUTHORIZED REPRESENTATIVE */}
        {activeTab === 'representative' && (
          <div className="space-y-6">
            <div className="border-b border-[#1E3A5F] pb-3">
              <h2 className="font-serif text-lg font-bold text-white">4. Authorized Representative & Signing Officer</h2>
              <p className="text-xs text-slate-300">
                Designated representative authorized to receive notices, review workpapers, and execute e-file authorization forms.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Representative Legal Full Name *</label>
                  <input
                    type="text"
                    value={dossier.authorizedRep?.fullName || ''}
                    onChange={(e) => updateDossier({
                      ...dossier,
                      authorizedRep: {
                        fullName: e.target.value,
                        title: dossier.authorizedRep?.title || 'Managing Member',
                        email: dossier.authorizedRep?.email || dossier.email,
                        phone: dossier.authorizedRep?.phone || dossier.phone,
                        relationshipOrCapacity: dossier.authorizedRep?.relationshipOrCapacity || 'Authorized Officer',
                        hasPowerOfAttorney: dossier.authorizedRep?.hasPowerOfAttorney || false
                      }
                    })}
                    placeholder="e.g. Eleanor Vance"
                    className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Officer Title / Legal Capacity *</label>
                  <input
                    type="text"
                    value={dossier.authorizedRep?.title || ''}
                    onChange={(e) => updateDossier({
                      ...dossier,
                      authorizedRep: {
                        ...(dossier.authorizedRep || { fullName: '', email: '', phone: '', relationshipOrCapacity: '', hasPowerOfAttorney: false }),
                        title: e.target.value
                      }
                    })}
                    placeholder="e.g. Managing Member, CEO, President, Trustee"
                    className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Representative Direct Email</label>
                  <input
                    type="email"
                    value={dossier.authorizedRep?.email || ''}
                    onChange={(e) => updateDossier({
                      ...dossier,
                      authorizedRep: {
                        ...(dossier.authorizedRep || { fullName: '', title: '', phone: '', relationshipOrCapacity: '', hasPowerOfAttorney: false }),
                        email: e.target.value
                      }
                    })}
                    placeholder="rep@example.com"
                    className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Representative Telephone</label>
                  <input
                    type="tel"
                    value={dossier.authorizedRep?.phone || ''}
                    onChange={(e) => updateDossier({
                      ...dossier,
                      authorizedRep: {
                        ...(dossier.authorizedRep || { fullName: '', title: '', email: '', relationshipOrCapacity: '', hasPowerOfAttorney: false }),
                        phone: e.target.value
                      }
                    })}
                    placeholder="(803) 555-0100"
                    className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300 pt-2">
                <input
                  type="checkbox"
                  checked={dossier.authorizedRep?.hasPowerOfAttorney || false}
                  onChange={(e) => updateDossier({
                    ...dossier,
                    authorizedRep: {
                      ...(dossier.authorizedRep || { fullName: '', title: '', email: '', phone: '', relationshipOrCapacity: '' }),
                      hasPowerOfAttorney: e.target.checked
                    }
                  })}
                  className="rounded text-[#C6A15B] focus:ring-[#C6A15B]"
                />
                <span>Designated representative holds legal Power of Attorney / corporate resolution for IRS representation</span>
              </label>
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setActiveTab('addresses')}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1E3A5F] hover:bg-[#2A4D7A] text-white flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('documents')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] flex items-center gap-1.5"
              >
                <span>Next: Supporting ID Documents</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 5: SUPPORTING ID DOCUMENTS (REUSES DOCUMENTUPLOAD) */}
        {activeTab === 'documents' && (
          <div className="space-y-6">
            <div className="border-b border-[#1E3A5F] pb-3">
              <h2 className="font-serif text-lg font-bold text-white">5. Supporting Identification & Formation Documents</h2>
              <p className="text-xs text-slate-300">
                Upload government-issued identification or secretary of state entity certificates into the encrypted vault.
              </p>
            </div>

            {/* List of uploaded ID documents */}
            {dossier.supportingDocs && dossier.supportingDocs.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-bold text-white text-xs uppercase tracking-wider text-[#C6A15B]">
                  Verified Vault Artifacts ({dossier.supportingDocs.length})
                </h3>
                <div className="space-y-2">
                  {dossier.supportingDocs.map((doc, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-[#07172B] border border-emerald-500/40 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <FileCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                        <div>
                          <div className="font-bold text-white">{doc.name}</div>
                          <div className="text-[10px] font-mono text-slate-400 flex items-center gap-2">
                            <span>SHA-256: {doc.sha256Hash.substring(0, 16)}...</span>
                            <span>&bull;</span>
                            <span>{doc.fileSize}</span>
                            <span>&bull;</span>
                            <span className="text-emerald-300">Malware Scanned Clean</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const remaining = dossier.supportingDocs.filter((_, i) => i !== idx);
                          updateDossier({ ...dossier, supportingDocs: remaining });
                        }}
                        className="text-xs text-red-400 hover:underline px-2 py-1"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reuse existing DocumentUpload */}
            <div className="bg-[#07172B] p-4 rounded-2xl border border-[#1E3A5F]">
              <DocumentUpload
                defaultCategory="id_verification"
                onUploadComplete={handleDocUploadComplete}
                allowedCategories={[
                  { value: 'id_verification', label: 'Government Photo ID / Passport' },
                  { value: 'prior_return', label: 'Articles of Organization / Corporate Filing' },
                  { value: 'other', label: 'IRS EIN Confirmation Letter (CP 575)' }
                ]}
              />
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setActiveTab('representative')}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1E3A5F] hover:bg-[#2A4D7A] text-white flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('duplicate')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] flex items-center gap-1.5"
              >
                <span>Next: Duplicate Resolution</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 6: 5-POINT DUPLICATE CHECK */}
        {activeTab === 'duplicate' && (
          <div className="space-y-6">
            <div className="border-b border-[#1E3A5F] pb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-lg font-bold text-white">6. Automated 5-Point Duplicate Resolution</h2>
                <p className="text-xs text-slate-300">
                  Real-time cross-verification across TIN, Legal Name, Email, Telephone, and Physical Address.
                </p>
              </div>
              <button
                onClick={handleRunDuplicateCheck}
                disabled={isSimulatingCheck}
                className="px-3 py-1.5 rounded-xl bg-[#C6A15B] hover:bg-[#D9BF7A] text-[#07172B] font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSimulatingCheck ? 'animate-spin' : ''}`} />
                <span>{isSimulatingCheck ? 'Scanning Registry...' : 'Re-run Duplicate Scan'}</span>
              </button>
            </div>

            {/* Duplicate Status Banner */}
            {dossier.duplicateCheck.status === 'CLEARED' ? (
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-center gap-3 text-emerald-200 text-xs">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-bold text-white">Zero Duplicate Collisions Detected</div>
                  <p className="text-emerald-300 text-[11px] mt-0.5">
                    Cross-referenced against firm client repository across SSN/EIN, legal entity name, email domain, telephone, and street address.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-500/50 space-y-3 text-xs">
                <div className="flex items-center gap-2 font-bold text-amber-200">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  <span>
                    {dossier.duplicateCheck.status === 'EXACT_MATCH' ? 'EXACT DUPLICATE IDENTIFIER DETECTED' : 'POTENTIAL CLIENT COLLISION DETECTED'}
                  </span>
                </div>
                <p className="text-slate-300 text-[11px]">
                  Under firm governance rules, onboarding is routed to compliance review to prevent identity collisions, split client dossiers, or duplicate IRS e-filings.
                </p>

                {/* Match details table */}
                <div className="space-y-2 mt-2">
                  {dossier.duplicateCheck.matches.map((m, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-[#07172B] border border-amber-500/30 text-[11px] flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-mono text-[10px] uppercase font-bold text-[#C6A15B] mr-2">
                          [{m.matchedField.toUpperCase()} COLLISION]
                        </span>
                        <span className="text-white font-semibold">{m.details}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-900/60 text-amber-300">
                        {m.confidence.toUpperCase()} CONFIDENCE
                      </span>
                    </div>
                  ))}
                </div>

                {/* Reviewer override section */}
                {isReviewerMode ? (
                  <div className="p-4 rounded-xl bg-[#07172B] border border-purple-500/40 space-y-3 mt-4">
                    <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Reviewer / Compliance Override Console</span>
                    </div>
                    <p className="text-slate-300 text-[11px]">
                      Authorized CPA/Reviewer may approve or reject after manual identity validation.
                    </p>
                    <input
                      type="text"
                      value={reviewOverrideNotes}
                      onChange={(e) => setReviewOverrideNotes(e.target.value)}
                      placeholder="Enter verification notes (e.g. Inspected SC Secretary of State registration)"
                      className="w-full bg-[#0D2340] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white text-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const updated = StageOneOnboardingService.resolveDuplicateReview(
                            dossier.clientId,
                            'override_approved',
                            'Elena Rostova, CPA',
                            reviewOverrideNotes || 'Identity verified via official SC SOS filings.'
                          );
                          if (updated) setDossier(updated);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                      >
                        Approve Compliance Override
                      </button>
                      <button
                        onClick={() => {
                          const updated = StageOneOnboardingService.resolveDuplicateReview(
                            dossier.clientId,
                            'rejected_duplicate',
                            'Elena Rostova, CPA',
                            reviewOverrideNotes || 'Confirmed duplicate record.'
                          );
                          if (updated) setDossier(updated);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
                      >
                        Reject as Duplicate
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-[#07172B] border border-[#1E3A5F] text-[11px] text-slate-400">
                    Routing status: <strong className="text-amber-300">Compliance Review Required</strong>. (Toggle &quot;Enable Reviewer Role&quot; above to simulate staff clearance).
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setActiveTab('documents')}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1E3A5F] hover:bg-[#2A4D7A] text-white flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('consent')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] flex items-center gap-1.5"
              >
                <span>Next: IRC Â§ 7216 Consent</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 7: ENGAGEMENT & IRC 7216 CONSENT */}
        {activeTab === 'consent' && (
          <div className="space-y-6">
            <div className="border-b border-[#1E3A5F] pb-3">
              <h2 className="font-serif text-lg font-bold text-white">7. Engagement Scope & IRC Â§ 7216 Consent</h2>
              <p className="text-xs text-slate-300">
                Statutory disclosures governing taxpayer data confidentiality, electronic communications, and professional scope.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#07172B] border border-[#1E3A5F] space-y-4 text-xs text-slate-300 max-h-64 overflow-y-auto">
              <h4 className="font-bold text-white uppercase tracking-wider text-[11px] text-[#C6A15B]">
                Statutory Disclosure Under Internal Revenue Code Â§ 7216
              </h4>
              <p>
                Federal law strictly prohibits tax return preparers from disclosing or using tax return information for purposes other than tax return preparation, unless expressly consented to by the taxpayer in writing.
              </p>
              <p>
                By executing this consent, you authorize <strong>A/R Tax Services, LLC</strong> to securely utilize your accounting records, prior year returns, and submitted workpapers for the sole purpose of preparing, analyzing, and filing authorized federal and state tax filings, bookkeeping reconciliations, and strategic planning models.
              </p>
              <p>
                Your confidential tax information will never be sold, disclosed to unauthorized third parties, or exported outside our encrypted US-based data infrastructure.
              </p>
              <h4 className="font-bold text-white uppercase tracking-wider text-[11px] text-[#C6A15B] pt-2">
                Scope of Professional Engagement & Pricing Schedule
              </h4>
              <p>
                Services provided adhere to AICPA Statements on Standards for Tax Services (SSTS) and Treasury Department Circular 230. Fees are assessed per the firm transparent fee schedule agreed during intake.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#07172B] border border-[#1E3A5F] cursor-pointer">
                <input
                  type="checkbox"
                  checked={dossier.engagementConsent.irc7216ConsentAccepted}
                  onChange={(e) => updateDossier({
                    ...dossier,
                    engagementConsent: { ...dossier.engagementConsent, irc7216ConsentAccepted: e.target.checked }
                  })}
                  className="mt-0.5 rounded text-[#C6A15B] focus:ring-[#C6A15B]"
                />
                <span>
                  <strong>IRC Â§ 7216 Consent:</strong> I formally authorize A/R Tax Services, LLC to process confidential tax return information under Treas. Reg. Â§ 301.7216-3.
                </span>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#07172B] border border-[#1E3A5F] cursor-pointer">
                <input
                  type="checkbox"
                  checked={dossier.engagementConsent.termsAndScopeAccepted}
                  onChange={(e) => updateDossier({
                    ...dossier,
                    engagementConsent: { ...dossier.engagementConsent, termsAndScopeAccepted: e.target.checked }
                  })}
                  className="mt-0.5 rounded text-[#C6A15B] focus:ring-[#C6A15B]"
                />
                <span>
                  <strong>Engagement Terms:</strong> I accept the professional terms of engagement, limitations of representation, and firm communication standards.
                </span>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#07172B] border border-[#1E3A5F] cursor-pointer">
                <input
                  type="checkbox"
                  checked={dossier.engagementConsent.pricingScheduleAcknowledged}
                  onChange={(e) => updateDossier({
                    ...dossier,
                    engagementConsent: { ...dossier.engagementConsent, pricingScheduleAcknowledged: e.target.checked }
                  })}
                  className="mt-0.5 rounded text-[#C6A15B] focus:ring-[#C6A15B]"
                />
                <span>
                  <strong>Fee Schedule Acknowledgement:</strong> I acknowledge receipt and agreement with the transparent fee schedule.
                </span>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#07172B] border border-[#1E3A5F] cursor-pointer">
                <input
                  type="checkbox"
                  checked={dossier.engagementConsent.electronicSignatureConsentAccepted}
                  onChange={(e) => updateDossier({
                    ...dossier,
                    engagementConsent: { ...dossier.engagementConsent, electronicSignatureConsentAccepted: e.target.checked }
                  })}
                  className="mt-0.5 rounded text-[#C6A15B] focus:ring-[#C6A15B]"
                />
                <span>
                  <strong>Electronic Signature Consent:</strong> Under the E-SIGN Act and UETA, I agree that my electronic typed signature constitutes a legally binding document execution.
                </span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Legal Full Name for E-Signature *</label>
                  <input
                    type="text"
                    value={dossier.engagementConsent.signerFullName}
                    onChange={(e) => updateDossier({
                      ...dossier,
                      engagementConsent: {
                        ...dossier.engagementConsent,
                        signerFullName: e.target.value,
                        signedAt: new Date().toISOString()
                      }
                    })}
                    placeholder="Type your full legal name"
                    className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white font-serif font-bold text-sm focus:outline-none focus:border-[#C6A15B]"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Timestamp & Provenance</label>
                  <div className="bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-slate-400 font-mono text-xs">
                    {dossier.engagementConsent.signedAt 
                      ? new Date(dossier.engagementConsent.signedAt).toLocaleString() 
                      : 'Pending Signature Input'}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setActiveTab('duplicate')}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1E3A5F] hover:bg-[#2A4D7A] text-white flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('readiness')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 flex items-center gap-1.5"
              >
                <span>View Readiness & Hard Exit Gate</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 8: READINESS CARD & HARD EXIT GATE */}
        {activeTab === 'readiness' && (
          <div className="space-y-6">
            <div className="border-b border-[#1E3A5F] pb-3">
              <h2 className="font-serif text-lg font-bold text-white">8. Onboarding Readiness Card & Hard Exit Gate</h2>
              <p className="text-xs text-slate-300">
                Enforcing strict exit gate governance: Stage One can only be completed when all 7 blocking conditions are satisfied.
              </p>
            </div>

            {/* Readiness Card */}
            <div className="p-6 rounded-3xl bg-[#07172B] border border-[#1E3A5F] shadow-2xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E3A5F] pb-3">
                <div>
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#C6A15B]" />
                    <span>Stage One Readiness Audit Checklist</span>
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Internal Client ID: <strong className="text-white font-mono">{dossier.clientId}</strong>
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-mono font-bold text-[#C6A15B]">
                    {readiness.completionPercentage}%
                  </div>
                  <div className="text-[10px] text-slate-400 uppercase font-mono">
                    {readiness.isReady ? 'All Gates Cleared' : 'Blocking Items Present'}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[#0D2340] h-2.5 rounded-full overflow-hidden border border-[#1E3A5F]">
                <div 
                  className={`h-full transition-all duration-300 ${
                    readiness.isReady ? 'bg-emerald-500' : 'bg-[#C6A15B]'
                  }`}
                  style={{ width: `${readiness.completionPercentage}%` }}
                />
              </div>

              {/* Checklist items */}
              <div className="space-y-2.5 pt-2">
                {readiness.blockingItems.map((item) => (
                  <div 
                    key={item.id} 
                    className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 transition-colors ${
                      item.satisfied 
                        ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200' 
                        : 'bg-red-950/20 border-red-500/40 text-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {item.satisfied ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                      <div>
                        <div className="font-semibold text-white">{item.label}</div>
                        {item.blockingReason && (
                          <div className="text-[10px] text-red-300 mt-0.5">{item.blockingReason}</div>
                        )}
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      item.satisfied ? 'bg-emerald-900/60 text-emerald-300' : 'bg-red-900/60 text-red-300'
                    }`}>
                      {item.satisfied ? 'PASSED' : 'BLOCKING'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Error or Success Notice */}
            {gateErrorMessage && (
              <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/60 text-red-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                <span>{gateErrorMessage}</span>
              </div>
            )}

            {gateSuccessMessage && (
              <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/60 text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>{gateSuccessMessage}</span>
              </div>
            )}

            {/* Hard Exit Gate Execution */}
            <div className="p-6 rounded-3xl bg-[#0D2340] border border-[#1E3A5F] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-white text-sm">Hard Exit Gate Enforcement</h4>
                  <p className="text-xs text-slate-300">
                    Once all blocking gates pass, Stage One is formally marked complete, activating Stage Two (Collect) and revealing the normal client dashboard.
                  </p>
                </div>

                {isStageOneCompleted ? (
                  <button
                    onClick={() => {
                      if (onNavigateToDashboard) {
                        onNavigateToDashboard();
                      } else {
                        setCurrentPage('client_portal');
                      }
                    }}
                    className="px-6 py-3 rounded-xl font-bold text-xs text-[#07172B] bg-emerald-400 hover:bg-emerald-300 transition-all shadow-xl flex items-center gap-2"
                  >
                    <span>Proceed to Normal Client Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleAttemptExitGate}
                    disabled={!readiness.isReady}
                    className={`px-6 py-3 rounded-xl font-bold text-xs transition-all shadow-xl flex items-center gap-2 ${
                      readiness.isReady 
                        ? 'bg-[#C6A15B] hover:bg-[#D9BF7A] text-[#07172B] cursor-pointer' 
                        : 'bg-[#1E3A5F]/50 text-slate-400 border border-[#1E3A5F] cursor-not-allowed opacity-60'
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                    <span>{readiness.isReady ? 'Finalize Stage One & Pass Exit Gate' : 'Hard Exit Gate Locked'}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-start pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('consent')}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1E3A5F] hover:bg-[#2A4D7A] text-white flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous: IRC Â§ 7216 Consent</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};














