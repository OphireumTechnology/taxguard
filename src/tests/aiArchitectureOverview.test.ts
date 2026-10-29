import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CANONICAL_AGENTS } from '../ai/registry';
import { findArchitectureMapping, hasUnmappedAgentAuthority } from '../ai/architectureMapping';
import {
  ARCHITECTURE_OVERVIEW_SOURCE, HUMAN_ONLY_COLUMNS, OVERVIEW_AGENTS, PAGE9_EXAMPLE, PERMISSION_COLUMNS,
  findOverviewAgent, overviewCeiling, overviewDecisions, overviewMatchesRegistry,
} from '../ai/architectureOverview';

const rank = { NOT_ALLOWED: 0, ILLEGIBLE: 0, CONDITIONAL: 1, ALLOWED: 2 } as const;

describe('architecture overview reconciliation', () => {
  it('records all 61 registry identities in order, frozen, with the source hash', () => {
    expect(overviewMatchesRegistry()).toBe(true);
    expect(OVERVIEW_AGENTS).toHaveLength(61);
    expect(Object.isFrozen(OVERVIEW_AGENTS)).toBe(true);
    for (const agent of OVERVIEW_AGENTS) expect(Object.isFrozen(agent)).toBe(true);
    expect(ARCHITECTURE_OVERVIEW_SOURCE.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(ARCHITECTURE_OVERVIEW_SOURCE.pages).toBe(11);
  });

  it('grants nothing: every identity stays DRAFT and the 58 unmapped agents stay denied', () => {
    const bounded = new Set(['A00', 'A10', 'A34']);
    for (const agent of CANONICAL_AGENTS) {
      expect(agent.status).toBe('DRAFT');
      const mapping = findArchitectureMapping(agent.agent_id);
      expect(mapping.allowed_execution_capabilities).toEqual([]);
      expect(mapping.allowed_workflow_stages).toEqual([]);
      expect(mapping.human_review_required).toBe(true);
      expect(hasUnmappedAgentAuthority(agent.agent_id)).toBe(!bounded.has(agent.agent_id));
    }
  });

  it('is never read by server governance, the gateway or any handler', () => {
    const files: string[] = [];
    const walk = (dir: string) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(e.name)) files.push(p); } };
    walk(path.resolve('src/server'));
    expect(files.length).toBeGreaterThan(50);
    const readers = files.filter(f => /architectureOverview/.test(fs.readFileSync(f, 'utf8')));
    expect(readers).toEqual([]);
  });

  it('records page-2 responsibilities for 59 agents and none for A10 and A39', () => {
    const missing = OVERVIEW_AGENTS.filter(a => a.responsibility === null).map(a => a.agent_id);
    expect(missing).toEqual(['A10', 'A39']);
    expect(findOverviewAgent('A30')).toMatchObject({ overview_name: 'Form Mapping Agent', human_gate: 'Preparer', gate_role: 'PREPARER' });
    expect(() => findOverviewAgent('A61')).toThrow('UNKNOWN_AI_AGENT');
  });

  it('maps a gate to an approval role only when it names exactly one', () => {
    expect(findOverviewAgent('A07').gate_role).toBe('REVIEWER');
    expect(findOverviewAgent('A34').gate_role).toBe('REVIEWER');
    expect(findOverviewAgent('A17').gate_role).toBe('CPA_EA');
    for (const id of ['A00', 'A12', 'A16', 'A18', 'A25', 'A37', 'A38', 'A44', 'A45', 'A57', 'A60']) expect(findOverviewAgent(id).gate_role, id).toBeNull();
    const roles = new Set(OVERVIEW_AGENTS.map(a => a.gate_role).filter(Boolean));
    expect([...roles].sort()).toEqual(['CPA_EA', 'PREPARER', 'REVIEWER']);
  });

  it('applies the owner decision that a "Staff" gate means REVIEWER, and nothing wider', () => {
    const staff = OVERVIEW_AGENTS.filter(a => a.human_gate === 'Staff').map(a => a.agent_id);
    expect(staff).toEqual(['A01', 'A02', 'A03', 'A05', 'A09', 'A36', 'A43', 'A46', 'A49', 'A50']);
    for (const id of staff) expect(findOverviewAgent(id).gate_role, id).toBe('REVIEWER');
    // "Staff / client" and "Authorized staff" are different gates and stay open.
    expect(findOverviewAgent('A44').gate_role).toBeNull();
    expect(findOverviewAgent('A47').gate_role).toBeNull();
    expect(OVERVIEW_AGENTS.filter(a => a.gate_role !== null)).toHaveLength(33);
    expect(OVERVIEW_AGENTS.filter(a => a.human_gate !== null && a.gate_role === null)).toHaveLength(26);
    // A gate role is metadata only: the mapping still requires the full human review chain.
    for (const id of staff) expect(findArchitectureMapping(id).human_review_required).toBe(true);
  });

  it('transcribes the 13 page-9 rows over all 21 columns', () => {
    expect(PAGE9_EXAMPLE.map(r => r.agent_id)).toEqual(['A05', 'A06', 'A07', 'A08', 'A11', 'A16', 'A18', 'A19', 'A20', 'A29', 'A34', 'A35', 'A38']);
    for (const row of PAGE9_EXAMPLE) expect(Object.keys(row.drawn)).toEqual(PERMISSION_COLUMNS.map(([key]) => key));
    const a07 = PAGE9_EXAMPLE.find(r => r.agent_id === 'A07')!.drawn;
    expect(a07).toMatchObject({ TOOL_OCR: 'ALLOWED', TOOL_LLM: 'ALLOWED', MARK_VERIFIED: 'NOT_ALLOWED', READ_ACCOUNTING: 'CONDITIONAL' });
    expect(PAGE9_EXAMPLE.find(r => r.agent_id === 'A38')!.drawn).toMatchObject({ TOOL_FILING_PROVIDER: 'ALLOWED', STAGE_FILE: 'ALLOWED', READ_TAX_RULES: 'ILLEGIBLE' });
  });

  it('narrows the ceiling: never wider than drawn, human-only and unreadable cells not allowed', () => {
    for (const row of PAGE9_EXAMPLE) {
      const ceiling = overviewCeiling(row.agent_id)!;
      expect(Object.isFrozen(ceiling)).toBe(true);
      for (const [key] of PERMISSION_COLUMNS) {
        expect(rank[ceiling[key]], `${row.agent_id} ${key}`).toBeLessThanOrEqual(rank[row.drawn[key]]);
        expect(ceiling[key]).not.toBe('ILLEGIBLE');
        if (HUMAN_ONLY_COLUMNS.has(key)) expect(ceiling[key], `${row.agent_id} ${key}`).toBe('NOT_ALLOWED');
      }
    }
    expect(overviewCeiling('A29')!.MARK_VERIFIED).toBe('NOT_ALLOWED');
    expect(overviewCeiling('A38')!.TOOL_FILING_PROVIDER).toBe('NOT_ALLOWED');
    expect(overviewCeiling('A07')!.TOOL_OCR).toBe('ALLOWED');
    expect(overviewCeiling('A01')).toBeNull();
  });

  it('lists the owner decisions, including the computed conflicts', () => {
    const decisions = overviewDecisions();
    expect(decisions.map(d => d.id)).toEqual(Array.from({ length: 13 }, (_, i) => `OV-${String(i + 1).padStart(2, '0')}`));
    const detail = (id: string) => decisions.find(d => d.id === id)!.detail;
    expect(detail('OV-04')).toContain('A44 "Staff / client"');
    expect(detail('OV-04')).not.toContain('A30');
    expect(detail('OV-06')).toContain('A29 Mark verified (allowed)');
    expect(detail('OV-06')).toContain('A38 File stage (allowed)');
    expect(detail('OV-06')).toContain('A16 Write return data (allowed)');
    expect(detail('OV-07')).toContain('A16 Approve tax position');
    expect(detail('OV-07')).toContain('A38 LLM');
    expect(detail('OV-04')).not.toContain('"Staff",');
  });

  it('records the owner answers of 2026-10-28 and leaves the rest open', () => {
    const status = Object.fromEntries(overviewDecisions().map(d => [d.id, d.status]));
    expect(status).toEqual({
      'OV-01': 'DECIDED', 'OV-02': 'OPEN', 'OV-03': 'OPEN', 'OV-04': 'PARTLY_DECIDED', 'OV-05': 'OPEN', 'OV-06': 'DECIDED',
      'OV-07': 'OPEN', 'OV-08': 'OPEN', 'OV-09': 'DECIDED', 'OV-10': 'OPEN', 'OV-11': 'OPEN', 'OV-12': 'OPEN', 'OV-13': 'OPEN',
    });
    for (const d of overviewDecisions()) {
      expect(Object.isFrozen(d)).toBe(true);
      if (d.status === 'OPEN') expect(d.resolution).toBeNull();
      else expect(d.resolution).toMatch(/^Owner, 2026-10-28: /);
    }
    // Deciding to keep human-only powers with people leaves the ceiling unchanged: still not allowed.
    for (const row of PAGE9_EXAMPLE) for (const key of HUMAN_ONLY_COLUMNS) expect(overviewCeiling(row.agent_id)![key]).toBe('NOT_ALLOWED');
  });
});
