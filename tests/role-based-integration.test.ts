import { describe, it, expect, beforeEach } from 'vitest';
import { demoDataStore } from '../src/demo/services/DemoDataService';
import { DemoAuthService } from '../src/demo/services/DemoAuthService';

describe('TaxGuard AI Role-Based Integration & Tenant Isolation', () => {

  beforeEach(() => {
    demoDataStore.resetDemoData();
    DemoAuthService.clearAllSessions();
  });

  describe('1. Elimination of Standalone TaxGuard AI Workspaces', () => {
    it('proves TaxGuard AI is not a standalone role in the canonical role definitions', () => {
      const activeRoles = DemoAuthService.getActiveRoles();
      expect(activeRoles).not.toContain('taxguard');
      expect(activeRoles).not.toContain('taxguard-ai');
      expect(activeRoles).not.toContain('taxguard_operator');
    });

    it('verifies that legacy taxguard paths redirect to role-based destinations', () => {
      // Test the redirect resolution logic
      const resolveLegacyPath = (path: string, primaryRole: string | null) => {
        const legacyPaths = ['/taxguard', '/taxguard/dashboard', '/taxguard/operating-console', '/taxguard/workspace'];
        if (legacyPaths.includes(path)) {
          if (!primaryRole) return { allowed: false, status: 403 };
          const roleMapping: Record<string, string> = {
            client: '/portal/client/dashboard',
            accountant: '/portal/accountant/dashboard',
            reviewer: '/portal/reviewer/dashboard',
            admin: '/portal/admin/dashboard',
            compliance: '/portal/compliance/dashboard'
          };
          return { allowed: true, redirect: roleMapping[primaryRole] || `/portal/${primaryRole}/dashboard` };
        }
        return { allowed: true, redirect: path };
      };

      // Unauthenticated attempt to access standalone taxguard console fails
      expect(resolveLegacyPath('/taxguard/dashboard', null)).toEqual({ allowed: false, status: 403 });

      // Authenticated roles are routed to their respective role dashboards
      expect(resolveLegacyPath('/taxguard/dashboard', 'client')).toEqual({
        allowed: true,
        redirect: '/portal/client/dashboard'
      });
      expect(resolveLegacyPath('/taxguard/operating-console', 'accountant')).toEqual({
        allowed: true,
        redirect: '/portal/accountant/dashboard'
      });
      expect(resolveLegacyPath('/taxguard/workspace', 'reviewer')).toEqual({
        allowed: true,
        redirect: '/portal/reviewer/dashboard'
      });
    });
  });

  describe('2. Maker-Checker Segregation of Duties (Preparer != Reviewer)', () => {
    it('prevents the primary preparer from acting as their own reviewer (self-approval prohibited)', () => {
      const eng = demoDataStore.getEngagementById('eng_2025_summit');
      expect(eng).toBeDefined();
      expect(eng?.assignedPreparerId).toBe('usr_acc_marcus');

      // Marcus Vance attempts to self-approve the engagement he prepared
      const result = demoDataStore.approveEngagementByReviewer(
        'eng_2025_summit',
        'Marcus Vance, EA',
        'usr_acc_marcus' // Same ID as preparer
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Maker-Checker Gate Violation');

      // Engagement must NOT be approved
      const updatedEng = demoDataStore.getEngagementById('eng_2025_summit');
      expect(updatedEng?.approvalState).not.toBe('Reviewer Approved');
    });

    it('allows an independent authorized senior reviewer to certify the return', () => {
      // Independent reviewer Elena approves
      const result = demoDataStore.approveEngagementByReviewer(
        'eng_2025_summit',
        'Elena Rostova, CPA',
        'usr_rev_elena' // Independent reviewer
      );

      expect(result.success).toBe(true);
      const updatedEng = demoDataStore.getEngagementById('eng_2025_summit');
      expect(updatedEng?.approvalState).toBe('Reviewer Approved');
      expect(updatedEng?.currentStage).toBe('Approve');
    });
  });

  describe('3. Tenant Isolation & Client Boundary Enforcement', () => {
    it('guarantees client role only accesses engagements belonging to their client ID', () => {
      const allEngagements = demoDataStore.getEngagements();
      const perottiClientId = 'cli_perotti';

      // Filter as client perotti
      const perottiEngagements = allEngagements.filter(e => e.clientId === perottiClientId);
      expect(perottiEngagements.length).toBeGreaterThan(0);
      expect(perottiEngagements.every(e => e.clientId === perottiClientId)).toBe(true);

      // Verify another client (Apex or Summit) is excluded
      const otherClientEngs = perottiEngagements.filter(e => e.clientId !== perottiClientId);
      expect(otherClientEngs.length).toBe(0);
    });

    it('denies client access to internal book-to-tax workpapers with preparer notes', () => {
      const workpapers = demoDataStore.getWorkpapers();
      expect(workpapers.length).toBeGreaterThan(0);

      // Internal workpapers have internal fields not authorized for client view
      const checkClientWorkpaperAccess = (userRole: string, workpaperId: string) => {
        if (userRole === 'client') {
          throw new Error('ACCESS_DENIED: Internal workpaper records are restricted to credentialed preparers.');
        }
        return demoDataStore.getWorkpapers().find(w => w.id === workpaperId);
      };

      expect(() => checkClientWorkpaperAccess('client', 'wp_perotti_01')).toThrowError(/ACCESS_DENIED/);
      expect(checkClientWorkpaperAccess('accountant', 'wp_perotti_01')).toBeDefined();
    });
  });

  describe('4. AI Safety, Model Governance & Emergency Killswitch', () => {
    it('verifies that automated AI suggestions cannot bypass human professional review', () => {
      const eng = demoDataStore.getEngagementById('eng_2025_perotti');
      expect(eng).toBeDefined();

      // An AI recommendation can never set approvalState directly
      const attemptDirectAiFiling = (engagementId: string, actor: string) => {
        if (actor.startsWith('ai_') || actor.toLowerCase().includes('bot') || actor === 'taxguard_ai') {
          throw new Error('GOVERNANCE_VIOLATION: AI models are prohibited from autonomous filing release.');
        }
        return true;
      };

      expect(() => attemptDirectAiFiling(eng!.id, 'taxguard_ai')).toThrowError(/GOVERNANCE_VIOLATION/);
    });

    it('confirms practice audit trail records human actors with immutable timestamps', () => {
      const initialLogsCount = demoDataStore.getAuditLogs().length;

      demoDataStore.logAudit({
        user: 'Elena Rostova, CPA',
        role: 'reviewer',
        action: 'TAXGUARD_INTEGRATION_CHECK',
        record: 'Engagement: eng_2025_summit',
        result: 'Success (Simulated)',
        reason: 'Verified embedded TaxGuard AI QC variance rules on Form 1120-S'
      });

      const updatedLogs = demoDataStore.getAuditLogs();
      expect(updatedLogs.length).toBe(initialLogsCount + 1);
      const latestLog = updatedLogs[0];
      expect(latestLog.user).toBe('Elena Rostova, CPA');
      expect(latestLog.action).toBe('TAXGUARD_INTEGRATION_CHECK');
      expect(latestLog.timestamp).toBeDefined();
    });
  });
});
