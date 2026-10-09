import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function readSource(relative: string): string {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

describe('TaxGuard Restored Client Dashboard Architecture', () => {
  // Navigation is now reusable; keep all existing assertions across both sources.
  const dashboardSource = readSource('src/components/portal/AuthenticatedClientDashboard.tsx')
    + readSource('src/components/portal/dashboard/ClientDashboardNavigation.tsx')
    + readSource('src/components/layout/DashboardApplicationShell.tsx');
  const routerSource = readSource('src/components/workflow/LiveClientWorkflowRouter.tsx');

  it('removes the large 18-stage button grid from the main content area', () => {
    // The previous 18-stage grid in the main content area has been removed
    expect(dashboardSource).not.toContain('grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-9');
    expect(dashboardSource).not.toContain('Unified 18-Stage Tax Operating Workflow Matrix');
  });

  it('provides the collapsible left navigation as primary workflow hierarchy', () => {
    expect(dashboardSource).toContain('sidebarCollapsed');
    expect(dashboardSource).toContain('toggleSidebar');
    expect(dashboardSource).toContain('WORKFLOW_STAGES');
    expect(dashboardSource).toContain('Workflow (18 Stages)');
  });

  it('maintains the conceptual left navigation groups: Overview, Workflow, Case, and Account', () => {
    expect(dashboardSource).toContain('Client Dashboard');
    expect(dashboardSource).toContain('Case &amp; Compliance');
    expect(dashboardSource).toContain('Account &amp; Security');
    expect(dashboardSource).toContain('documents');
    expect(dashboardSource).toContain('exceptions');
    expect(dashboardSource).toContain('messages');
    expect(dashboardSource).toContain('activity');
    expect(dashboardSource).toContain('profile');
    expect(dashboardSource).toContain('security');
    expect(dashboardSource).toContain('Sign Out');
  });

  it('binds authoritative stage status to the left navigation', () => {
    expect(dashboardSource).toContain('getStageStatus');
    expect(dashboardSource).toContain('authority?.workflow?.activeStage');
    expect(dashboardSource).toContain('CheckCircle2');
    expect(dashboardSource).toContain('STAGE LOCKED BY TAXGUARD HARD GATE');
  });

  it('enforces hard gate locking on stages 03 through 18', () => {
    expect(dashboardSource).toContain('selectedLockedStage');
    expect(dashboardSource).toContain('Complete <strong>Stage 02 Collect</strong> before Stage');
    expect(dashboardSource).toContain('Go to Active Stage 02 (Collect) Workspace');
  });

  it('loads the existing production StageTwoCollectionWorkspace in Stage 02 context', () => {
    expect(dashboardSource).toContain('<StageTwoCollectionWorkspace');
    expect(dashboardSource).toContain('serverStageThreeEligible');
    expect(dashboardSource).toContain('onServerWorkflowRefresh');
  });

  it('permits Stage 01 to be opened in read-only review mode', () => {
    expect(dashboardSource).toContain('Stage 01 (Onboard) Dossier');
    expect(dashboardSource).toContain('Read-Only Review');
    expect(dashboardSource).toContain('<StageOneIdentityWizard');
  });

  it('renders correct IRC § 7216 statutory disclosure and no mojibake', () => {
    expect(dashboardSource).toContain('IRC § 7216 Consent');
    expect(dashboardSource).not.toContain('\uFFFD');
    expect(dashboardSource).not.toContain('localhost');
  });

  it('routes live stage 02 through AuthenticatedClientDashboard with persistent navigation', () => {
    expect(routerSource).toContain('<AuthenticatedClientDashboard');
    expect(routerSource).toContain('initialNav="stage_02"');
    expect(routerSource).toContain('initialNav="stage_01"');
    expect(routerSource).toContain('initialNav="home"');
  });
});
