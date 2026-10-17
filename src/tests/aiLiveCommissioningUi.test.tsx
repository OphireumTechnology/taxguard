import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LiveCommissioningTable, type LiveCommissioning, type LiveCommissioningAgent } from '../components/admin/AiLiveCommissioningRecords';

// Contract C7 live records view (synthetic): read-only, no enable controls, nothing commissioned.
const agent = (over: Partial<LiveCommissioningAgent> = {}): LiveCommissioningAgent => ({ agent_id: 'A01', agent_name: 'Synthetic Agent', registry_status: 'DRAFT', risk_class: 'MATERIAL', stopped: false,
  model: { configured: false, approved: false }, prompt: { configured: false, approved: false }, grants: { resources: 0, non_read: 0, data_classes: 0, stages: 0 },
  active_approval_policies: 0, recorded_runs: 0, commissioning_state: 'DRAFT', commissioning_record: null, material_actions: 'BLOCKED', ...over });
const data = (agents: LiveCommissioningAgent[], global_stop = false): LiveCommissioning => ({ source: 'LIVE_GOVERNANCE_TABLES', global_stop, material_actions: 'BLOCKED', agents });

describe('live commissioning records view', () => {
  it('shows registry state as recorded and offers no controls', () => {
    const out = renderToStaticMarkup(<LiveCommissioningTable data={data([agent(), agent({ agent_id: 'A34', registry_status: 'ACTIVE', commissioning_state: 'NOT_COMMISSIONED',
      model: { configured: true, approved: false }, grants: { resources: 3, non_read: 1, data_classes: 1, stages: 1 }, recorded_runs: 30 })])} />);
    expect(out).toContain('Draft');
    expect(out).toContain('Not commissioned');
    expect(out).toContain('Material actions (AI-16): blocked');
    expect(out).toContain('No agent has a commissioning record');
    expect(out).not.toMatch(/<button|<input|<select|<form|>\s*(Enable|Approve|Activate|Commission)\b/i);
    expect(out).not.toMatch(/>Commissioned</);
  });
  it('reports emergency stops', () => {
    const out = renderToStaticMarkup(<LiveCommissioningTable data={data([agent({ stopped: true, commissioning_state: 'STOPPED' })], true)} />);
    expect(out).toContain('A global emergency stop is active');
    expect(out).toContain('Stopped by emergency stop');
  });
});
