import { describe, it, expect, beforeEach } from 'vitest';
import { 
  StageOneOnboardingService, 
  StageOneDossier 
} from '../services/stageOneOnboardingService';
import { EnvironmentConfigService } from '../config/environmentConfig';
import { INITIAL_DEMO_CLIENTS } from '../demo/mockData';

describe('Stage One Onboard - Unified 18-Stage Operating Workflow', () => {
  beforeEach(() => {
    // Clear localStorage mock if running in test environment
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    EnvironmentConfigService.setEnvironment('demo');
  });

  describe('1. Internal Client ID & Minimal Registration Creation', () => {
    it('generates internal client ID matching AR-CLT-YYYY-XXXXX format', () => {
      const clientId = StageOneOnboardingService.generateClientId();
      const currentYear = new Date().getFullYear();
      expect(clientId).toMatch(new RegExp(`^AR-CLT-${currentYear}-\\d{5}$`));
    });

    it('creates minimal dossier with active stage 1', () => {
      const dossier = StageOneOnboardingService.createInitialDossier({
        fullName: 'Eleanor Vance',
        email: 'evance.unique@palmetto-demo.com',
        phone: '(803) 777-9911',
        taxpayerType: 'entity',
        businessName: 'Palmetto Capital Ventures LLC'
      });

      expect(dossier.clientId).toBeDefined();
      expect(dossier.activeWorkflowStage).toBe(1);
      expect(dossier.stageOneCompleted).toBe(false);
      expect(dossier.legalName).toBe('Eleanor Vance');
      expect(dossier.dbaName).toBe('Palmetto Capital Ventures LLC');
      expect(dossier.readiness.isReady).toBe(false);
    });
  });

  describe('2. TIN Masking & Security (Never Exposing Full TINs)', () => {
    it('masks SSN properly and never returns raw digits', () => {
      const { masked, last4 } = StageOneOnboardingService.maskTIN('123456789', 'ssn');
      expect(masked).toBe('***-**-6789');
      expect(last4).toBe('6789');
      expect(masked).not.toContain('12345');
    });

    it('masks EIN properly and never returns raw digits', () => {
      const { masked, last4 } = StageOneOnboardingService.maskTIN('579842109', 'ein');
      expect(masked).toBe('XX-XXX2109');
      expect(last4).toBe('2109');
      expect(masked).not.toContain('57984');
    });
  });

  describe('3. Automated 5-Point Duplicate Check & Review Routing', () => {
    it('detects exact email collision against existing client and routes to review', () => {
      const existing = INITIAL_DEMO_CLIENTS[0]; // Michael Perotti: m.perotti@example.com
      const report = StageOneOnboardingService.runDuplicateCheck({
        email: existing.email,
        phone: '(555) 000-1111',
        legalName: 'Brand New Taxpayer LLC'
      });

      expect(report.status).toBe('EXACT_MATCH');
      expect(report.routedToReview).toBe(true);
      expect(report.matches.some(m => m.matchedField === 'email')).toBe(true);
    });

    it('detects telephone collision against existing client and routes to review', () => {
      const existing = INITIAL_DEMO_CLIENTS[1]; // Sarah Jenkins: (803) 555-0144
      const report = StageOneOnboardingService.runDuplicateCheck({
        email: 'completely.new@example.com',
        phone: existing.phone,
        legalName: 'Unique Entity LLC'
      });

      expect(report.routedToReview).toBe(true);
      expect(report.matches.some(m => m.matchedField === 'phone')).toBe(true);
    });

    it('detects entity legal name collision against existing client', () => {
      const existing = INITIAL_DEMO_CLIENTS[0]; // Perotti Capital Holdings, LLC
      const report = StageOneOnboardingService.runDuplicateCheck({
        email: 'unique.person@example.com',
        phone: '(803) 555-8899',
        legalName: 'Perotti Capital Holdings, LLC'
      });

      expect(report.routedToReview).toBe(true);
      expect(report.matches.some(m => m.matchedField === 'name')).toBe(true);
    });

    it('clears check with zero collisions for a truly unique client', () => {
      const report = StageOneOnboardingService.runDuplicateCheck({
        email: 'unique.taxpayer.2025@nowhere-demo.org',
        phone: '(803) 999-4433',
        legalName: 'Unique Blue Ridge Advisory LLC',
        residentialOrPrincipalAddress: {
          street: '999 New Forest Rd',
          city: 'Aiken',
          state: 'SC',
          zip: '29801',
          country: 'United States'
        }
      });

      expect(report.status).toBe('CLEARED');
      expect(report.routedToReview).toBe(false);
      expect(report.matches.length).toBe(0);
    });

    it('allows compliance reviewer override to approve a flagged collision', () => {
      const dossier = StageOneOnboardingService.createInitialDossier({
        fullName: 'Michael Perotti Duplicate Test',
        email: 'm.perotti@example.com',
        phone: '(678) 205-9486'
      });

      const dupReport = StageOneOnboardingService.runDuplicateCheck(dossier);
      dossier.duplicateCheck = dupReport;
      StageOneOnboardingService.saveDossier(dossier);
      expect(dossier.duplicateCheck.routedToReview).toBe(true);

      const resolved = StageOneOnboardingService.resolveDuplicateReview(
        dossier.clientId,
        'override_approved',
        'Elena Rostova, CPA',
        'Verified distinct legal entity and taxpayer through Secretary of State.'
      );

      expect(resolved?.duplicateCheck.reviewDecision).toBe('override_approved');
      expect(resolved?.duplicateCheck.routedToReview).toBe(false);
      expect(resolved?.readiness.blockingItems.find(b => b.id === 'gate_duplicate_check')?.satisfied).toBe(true);
    });
  });

  describe('4. Onboarding Readiness Card & Hard Exit Gate', () => {
    it('locks exit gate if required blocking items are missing', () => {
      const dossier = StageOneOnboardingService.createInitialDossier({
        fullName: 'Jane Doe',
        email: 'jane.doe.test@example.com',
        phone: '(803) 555-4321'
      });

      const readiness = StageOneOnboardingService.evaluateReadiness(dossier);
      expect(readiness.isReady).toBe(false);
      expect(readiness.completionPercentage).toBeLessThan(100);

      const result = StageOneOnboardingService.passHardExitGate(dossier.clientId);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Hard Exit Gate Locked');
    });

    it('satisfies exit gate when all 7 criteria are met, activates Stage 2', () => {
      const dossier = StageOneOnboardingService.createInitialDossier({
        fullName: 'Palmetto Peak Ventures LLC',
        email: 'intake@palmetto-peak-demo.com',
        phone: '(803) 777-1234',
        taxpayerType: 'entity',
        businessName: 'Palmetto Peak Ventures'
      });

      // Complete all 7 gates
      dossier.tinLast4 = '8842';
      dossier.maskedTIN = 'XX-XXX8842';
      dossier.residentialOrPrincipalAddress = {
        street: '1201 Main St, Suite 1500',
        city: 'Columbia',
        state: 'SC',
        zip: '29201',
        country: 'United States'
      };
      dossier.mailingAddress = dossier.residentialOrPrincipalAddress;
      dossier.mailingSameAsResidential = true;
      dossier.authorizedRep = {
        fullName: 'Eleanor Vance',
        title: 'Managing Member',
        email: 'eleanor@palmetto-peak-demo.com',
        phone: '(803) 777-1234',
        relationshipOrCapacity: 'Authorized Member',
        hasPowerOfAttorney: true
      };
      dossier.supportingDocs = [
        {
          id: 'doc_01',
          name: 'Articles_of_Org.pdf',
          category: 'articles_of_org',
          sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          uploadedAt: new Date().toISOString(),
          fileSize: '1.4 MB',
          verified: true
        }
      ];
      dossier.duplicateCheck = {
        timestamp: new Date().toISOString(),
        status: 'CLEARED',
        matches: [],
        routedToReview: false
      };
      dossier.engagementConsent = {
        irc7216ConsentAccepted: true,
        termsAndScopeAccepted: true,
        pricingScheduleAcknowledged: true,
        electronicSignatureConsentAccepted: true,
        signerFullName: 'Eleanor Vance',
        signedAt: new Date().toISOString(),
        ipAddress: '127.0.0.1',
        consentVersion: '2025.1-IRC7216'
      };

      StageOneOnboardingService.saveDossier(dossier);

      const readiness = StageOneOnboardingService.evaluateReadiness(dossier);
      expect(readiness.isReady).toBe(true);
      expect(readiness.completionPercentage).toBe(100);

      // Pass Hard Exit Gate
      const gateResult = StageOneOnboardingService.passHardExitGate(dossier.clientId);
      expect(gateResult.success).toBe(true);
      expect(gateResult.dossier?.stageOneCompleted).toBe(true);
      expect(gateResult.dossier?.activeWorkflowStage).toBe(2); // Activates Stage 2: Collect
      expect(StageOneOnboardingService.hasPassedHardExitGate(dossier.clientId)).toBe(true);

      const invalidatedDossier = gateResult.dossier!;
      invalidatedDossier.supportingDocs[0].verified = false;
      StageOneOnboardingService.saveDossier(invalidatedDossier);

      expect(StageOneOnboardingService.hasPassedHardExitGate(dossier.clientId)).toBe(false);
      expect(StageOneOnboardingService.getDossier(dossier.clientId)?.readiness.overallStatus).toBe('incomplete');
    });
  });

  describe('5. Environment Behavior Configuration', () => {
    it('strictly enforces no live filings in demo environment', () => {
      const demoConfig = EnvironmentConfigService.getConfig();
      expect(demoConfig.allowLiveFilings).toBe(false);
      expect(demoConfig.fictionalDataOnly).toBe(true);
      expect(demoConfig.maskSensitiveFields).toBe(true);
    });

    it('switches between environments while maintaining safety flags', () => {
      EnvironmentConfigService.setEnvironment('uat_staging');
      const uatConfig = EnvironmentConfigService.getConfig();
      expect(uatConfig.environment).toBe('uat_staging');
      expect(uatConfig.allowLiveFilings).toBe(false);
    });
  });
});
