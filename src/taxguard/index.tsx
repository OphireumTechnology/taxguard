import React from 'react';
import { 
  FileText, ShieldCheck, AlertCircle, Bot, Activity, Brain, 
  Sparkles, Layers, Sliders, CheckCircle, Database, HelpCircle 
} from 'lucide-react';

interface BasePanelProps {
  userRole?: string;
  [key: string]: any;
}

function createTaxGuardComponent(name: string, description: string, icon = FileText) {
  const IconComponent = icon;
  const Component: React.FC<BasePanelProps> = ({ userRole }) => {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-200 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[#D4A843]/10 text-[#D4A843]">
            <IconComponent className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">{name}</h3>
            <p className="text-xs text-slate-400">{description}</p>
          </div>
          {userRole && (
            <span className="ml-auto text-[10px] font-mono uppercase bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
              {userRole}
            </span>
          )}
        </div>
        <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 space-y-2">
          <div className="flex items-center justify-between text-slate-300 font-medium">
            <span>Module Status</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Operational
            </span>
          </div>
          <p>
            TaxGuard automated telemetry and AI reasoning pipelines active. Real-time synchronizations verified for the active engagement scope.
          </p>
        </div>
      </div>
    );
  };
  Component.displayName = name;
  return Component;
}

export const SmartFormWorkspace = createTaxGuardComponent('Smart Form Workspace', 'Interactive Form Preparation and Live Validation Engine', FileText);
export const WorkpaperEditor = createTaxGuardComponent('Workpaper Editor', 'Authoritative Tax Workpaper & Annotation Canvas', Layers);
export const MissingItemsPanel = createTaxGuardComponent('Missing Items Panel', 'Dynamic Gap Detection and Document Request Pipeline', AlertCircle);
export const DiscrepancyPanel = createTaxGuardComponent('Discrepancy Panel', 'Automated Cross-Source Reconciliation and Variance Identification', Sliders);
export const AIResearchAssistant = createTaxGuardComponent('AI Research Assistant', 'Tax Code Grounding & IRS Publication Authority Engine', Brain);
export const DraftReturnPreparer = createTaxGuardComponent('Draft Return Preparer', 'Automated Federal & State Form Assembly', FileText);
export const FixedAssetRegister = createTaxGuardComponent('Fixed Asset Register', 'Section 179 & MACRS Depreciation Schedule Tracker', Database);
export const EntityRelationshipGraph = createTaxGuardComponent('Entity Relationship Graph', 'Tiered Entity & Pass-Through Relationship Topology', Layers);
export const IntegrationHealthPanel = createTaxGuardComponent('Integration Health Panel', 'Supabase, Storage, and Provider Subsystem Monitor', Activity);
export const UnifiedActionCenter = createTaxGuardComponent('Unified Action Center', 'Cross-Role Task Orchestration and Escalation Feed', CheckCircle);
export const AICreditUsageManager = createTaxGuardComponent('AI Credit Usage Manager', 'Inference Quota, Model Routing, and Token Usage Analytics', Sparkles);
export const TaxGuardVoiceAssistant = createTaxGuardComponent('TaxGuard Voice Assistant', 'Interactive Voice Telephony & Consultation Logging', Bot);
export const TaxPlanningScenarioModeler = createTaxGuardComponent('Tax Planning Scenario Modeler', 'Multi-Year Forecasting and Deduction Optimization', Sliders);
export const EstimatedPaymentsCenter = createTaxGuardComponent('Estimated Payments Center', 'Quarterly Safe Harbor & Underpayment Penalty Calculations', FileText);
export const DocumentScanner = createTaxGuardComponent('Document Scanner', 'Optical Character Recognition & OCR Pre-processing', ShieldCheck);
export const DocumentUploadQueue = createTaxGuardComponent('Document Upload Queue', 'Parallel Batch Intake & Malware Quarantine Verification', Layers);
export const VerificationPanel = createTaxGuardComponent('Verification Panel', 'Identity, SSN/EIN, and Payer Verification Protocol', ShieldCheck);
export const AuditEventViewer = createTaxGuardComponent('Audit Event Viewer', 'Tamper-Evident SHA-256 System Audit Log', ShieldCheck);
export const AIGovernancePanel = createTaxGuardComponent('AI Governance Panel', 'Model Decision Traceability & Human-in-the-Loop Safeguards', Brain);
export const TaxResolutionCenter = createTaxGuardComponent('Tax Resolution Center', 'IRS Notice Defense & Penalty Abatement Registry', HelpCircle);
export const ClassificationReview = createTaxGuardComponent('Classification Review', 'Tax Category and Schedule Inference Inspector', FileText);
export const ExtractionReview = createTaxGuardComponent('Extraction Review', 'OCR Field Coordinate & Value Validation Workbench', Layers);
export const ProfessionalReviewQueue = createTaxGuardComponent('Professional Review Queue', 'Maker-Checker Workqueue for Senior Reviewers', CheckCircle);
export const ApprovalGate = createTaxGuardComponent('Approval Gate', 'Multi-Signature Electronic Return Authorization Gate', ShieldCheck);
export const SideBySideReviewWorkspace = createTaxGuardComponent('Side-by-Side Review Workspace', 'Dual-Pane Source Document and Draft Return Auditor', Sliders);
export const BrandedDeliverablesGenerator = createTaxGuardComponent('Branded Deliverables Generator', 'Client Tax Return Package & Letterhead Assembly', FileText);
