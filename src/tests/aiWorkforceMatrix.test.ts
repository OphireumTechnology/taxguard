import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CANONICAL_AGENTS } from '../ai/registry';
import { OVERVIEW_AGENTS } from '../ai/architectureOverview';
import {
  buildWorkforceMatrix,
  renderWorkforceMatrixMarkdown,
  workforceMatrixTotals,
} from '../ai/workforceMatrix';
import { ALL_WORKFORCE_AGENT_SPECS } from '../server/ai/workforce/WorkforceDispatcher';

describe('TaxGuard 61-Agent Workforce Matrix (A00–A60)', () => {
  const rows = buildWorkforceMatrix();
  const totals = workforceMatrixTotals(rows);

  it('contains exactly one row for every canonical ID from A00 through A60 in exact order', () => {
    expect(rows).toHaveLength(61);
    expect(CANONICAL_AGENTS).toHaveLength(61);
    expect(OVERVIEW_AGENTS).toHaveLength(61);
    expect(ALL_WORKFORCE_AGENT_SPECS).toHaveLength(61);

    const expectedIds = Array.from({ length: 61 }, (_, i) => `A${String(i).padStart(2, '0')}`);
    expect(rows.map(r => r.agentId)).toEqual(expectedIds);
    expect(CANONICAL_AGENTS.map(a => a.agent_id)).toEqual(expectedIds);
    expect(OVERVIEW_AGENTS.map(a => a.agent_id)).toEqual(expectedIds);
    expect(ALL_WORKFORCE_AGENT_SPECS.map(s => s.agent_id)).toEqual(expectedIds);
  });

  it('populates all 9 required per-agent columns on every single row', () => {
    for (const row of rows) {
      expect(row.plannedTaskAndSurface.trim().length).toBeGreaterThan(10);
      expect(row.implementedDomainFunctionAndSourcePath.trim().length).toBeGreaterThan(10);
      expect(row.authorizedInputsToolsAndAudience.trim().length).toBeGreaterThan(10);
      expect(row.apiWorkerDbAndWebsiteIntegration.trim().length).toBeGreaterThan(10);
      expect(row.humanReviewerAndPermittedDecisions.trim().length).toBeGreaterThan(10);
      expect(row.localTestEvidence.trim().length).toBeGreaterThan(10);
      expect(row.hostedStagingAcceptance.trim().length).toBeGreaterThan(10);
      expect(row.productionCommissioningAndReleaseEvidence.trim().length).toBeGreaterThan(10);
      expect(row.openDependencyOrOwnerDecision.trim().length).toBeGreaterThan(5);
    }
  });

  it('reports separate honest lifecycle totals without inflating staging or production counts', () => {
    expect(totals).toEqual({
      totalRows: 61,
      designed: 61,
      locallyImplemented: 60,
      reservedFailClosed: 1,
      websiteIntegrated: 60,
      stagingAccepted: 0,
      productionCommissioned: 0,
    });

    const a39 = rows.find(r => r.agentId === 'A39');
    expect(a39).toBeDefined();
    expect(a39!.locallyImplemented).toBe(false);
    expect(a39!.websiteIntegrated).toBe(false);
    expect(a39!.stagingAccepted).toBe(false);
    expect(a39!.productionCommissioned).toBe(false);
    expect(a39!.openDependencyOrOwnerDecision).toContain('OV-01');

    const a10 = rows.find(r => r.agentId === 'A10');
    expect(a10).toBeDefined();
    expect(a10!.locallyImplemented).toBe(true);
    expect(a10!.websiteIntegrated).toBe(true);
    expect(a10!.openDependencyOrOwnerDecision).toContain('Owner approval');

    const a07 = rows.find(r => r.agentId === 'A07');
    expect(a07).toBeDefined();
    expect(a07!.openDependencyOrOwnerDecision).toContain('OCR');
  });

  it('keeps docs/development/ai-workforce-matrix.md strictly synchronized with the code source of truth', () => {
    const markdownPath = resolve(process.cwd(), 'docs/development/ai-workforce-matrix.md');
    const onDisk = readFileSync(markdownPath, 'utf8');
    expect(onDisk).toBe(renderWorkforceMatrixMarkdown());
  });
});
