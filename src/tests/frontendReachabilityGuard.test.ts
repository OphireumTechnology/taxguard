import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
// @ts-ignore -- plain ESM script without type declarations
import { audit } from '../../scripts/frontend/reachability-audit.mjs';

// Phase 12B guard over every file reachable from src/main.tsx: no retired API calls, no
// fabricated status claims, no simulated latency, no native dialogs, no mojibake, and legacy
// in-memory APIs only in the documented retained consumers. New violations fail this test.
let r: { reachable: number; unreachableComponents: string[]; findings: Array<{ code: string; file: string; line: number }> };
beforeAll(() => { r = audit(); });
const files = (code: string) => [...new Set(r.findings.filter(f => f.code === code).map(f => f.file))].sort();

describe('reachable frontend', () => {
  it('traces the application from its entry point', () => { expect(r.reachable).toBeGreaterThan(150); });
  it.each(['RETIRED_API', 'MOJIBAKE', 'HARDCODED_STATUS_CLAIM', 'SIMULATED_LATENCY'])('contains no %s', code => { expect(files(code)).toEqual([]); });
  it('uses no native alert / confirm / prompt dialogs', () => {
    // StaffAccessManagementPanel calls its own local function named confirm (reviewed).
    expect(files('BROWSER_DIALOG')).toEqual(['src/components/admin/StaffAccessManagementPanel.tsx']);
    expect(readFileSync('src/components/admin/StaffAccessManagementPanel.tsx', 'utf8')).toMatch(/const confirm = /);
  });
  it('calls legacy in-memory APIs only from the documented retained consumers', () => {
    // Phase 13A: the in-memory consultation room (C5) and onboarding wizard (C4) are no longer reachable.
    expect(files('LEGACY_IN_MEMORY_API')).toEqual(['src/services/api.ts']);
  });
  it('no longer reaches the browser-local or fabricated client views', () => {
    for (const legacy of ['src/components/portal/views/MyDocumentsClientVault.tsx', 'src/components/collection/StageTwoCollectionWorkspace.tsx', 'src/components/validation/StageThreeValidationWorkspace.tsx',
      'src/components/portal/views/stages/StageTwelveFileView.tsx', 'src/components/portal/views/stages/StageElevenSignView.tsx', 'src/components/portal/views/stages/StageThirteenFeedbackView.tsx',
      'src/components/portal/views/stages/StageFourteenResolveView.tsx', 'src/components/portal/views/stages/StageFifteenMonitorView.tsx', 'src/components/portal/views/stages/StageNinePrepareTaxesView.tsx',
      'src/components/consultation/VirtualConsultationRoom.tsx', 'src/components/workspace/StaffOnboardingWizard.tsx'])
      expect(r.unreachableComponents, legacy).toContain(legacy);
  });
  it('reaches the durable replacements', () => {
    const reachableFindingsOrFiles = new Set([...r.findings.map(f => f.file)]);
    void reachableFindingsOrFiles;
    for (const durable of ['src/components/collection/DurableClientCollectionWorkspace.tsx', 'src/components/portal/views/stages/TaxStageStatusView.tsx', 'src/components/portal/dashboard/ClientNotificationsPanel.tsx',
      'src/components/admin/AiCommissioningView.tsx', 'src/components/workspace/BookToTaxPanel.tsx', 'src/components/public/PlanRequestDialog.tsx',
      'src/components/portal/views/stages/ClientCaseStageView.tsx', 'src/components/portal/dashboard/ClientConsultationHistoryPanel.tsx',
      'src/components/workspace/StaffOnboardingStatusPage.tsx', 'src/components/appointments/ConsultationRoomPanel.tsx'])
      expect(r.unreachableComponents, durable).not.toContain(durable);
  });
});
