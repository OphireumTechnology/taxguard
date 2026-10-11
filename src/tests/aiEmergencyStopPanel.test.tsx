import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ mode: 'default' as 'default' | 'confirming' | 'agent' }));
vi.mock('../services/api', () => ({ api: { caseAuthority: { listAiKillSwitches: vi.fn(() => new Promise(() => {})), activateAiKillSwitch: vi.fn() } } }));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  const state: typeof actual.useState = ((initial: any) => {
    let value = initial;
    if (fixture.mode === 'confirming' && initial === false) value = true;
    if (fixture.mode === 'confirming' && initial === '') value = 'Synthetic incident requires stopping AI';
    if (fixture.mode === 'agent' && initial === 'GLOBAL') value = 'AGENT';
    return actual.useState(value);
  }) as typeof actual.useState;
  return { ...actual, useState: state };
});
import { AiEmergencyStopPanel, interpretKillSwitchActivation, killSwitchFailureMessage, parseKillSwitchRows } from '../components/admin/AiEmergencyStopPanel';
afterEach(() => { fixture.mode = 'default'; });

describe('activation result interpretation', () => {
  it('reports engagement only for an explicit server confirmation', () => {
    expect(interpretKillSwitchActivation({ switch_id: 's1', target: 'GLOBAL', enabled: true, already_active: false })).toContain('Emergency stop engaged for GLOBAL');
    expect(interpretKillSwitchActivation({ switch_id: 's1', target: 'A07', enabled: true, already_active: true })).toContain('already engaged');
  });
  it.each([[undefined], [{}], [{ switch_id: 's1', target: 'GLOBAL', enabled: 'true' }], [{ target: 'GLOBAL', enabled: true }], [{ switch_id: 's1', enabled: true }]])(
    'refuses to claim success for unconfirmed response %#', result => {
      expect(() => interpretKillSwitchActivation(result)).toThrow('Unconfirmed response');
    });
  it('maps known denials and never claims the stop engaged on unknown failures', () => {
    expect(killSwitchFailureMessage({ code: 'AI_KILL_SWITCH_ROLE_DENIED' })).toMatch(/not authorized/);
    const unknown = killSwitchFailureMessage({ code: 'AI_GOVERNANCE_UNAVAILABLE' });
    expect(unknown).toMatch(/NOT confirmed/);
    expect(killSwitchFailureMessage(new Error('socket hang up 10.0.0.5'))).not.toContain('10.0.0.5');
  });
  it('validates listed rows strictly', () => {
    expect(parseKillSwitchRows([{ switch_id: 's', scope: 'GLOBAL', target: 'GLOBAL', enabled: true, reason: 'r', activated_by: 'u', activated_at: 't' }])).toHaveLength(1);
    expect(() => parseKillSwitchRows({})).toThrow();
    expect(() => parseKillSwitchRows([{ switch_id: 's', scope: 'EVERYTHING', target: 'x', enabled: true, activated_by: 'u', activated_at: 't' }])).toThrow();
  });
});

describe('panel rendering', () => {
  it('starts with the engage button disabled until a valid reason is entered and states that lifting is unavailable', () => {
    const html = renderToStaticMarkup(<AiEmergencyStopPanel />);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""[^>]*>Engage emergency stop/);
    expect(html).toContain('Lifting a stop is not available in this workspace');
    expect(html).toContain('Loading recorded stops');
    const buttonLabels = [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map(m => m[1].replace(/<[^>]+>/g, ''));
    expect(buttonLabels.length).toBeGreaterThan(0);
    for (const label of buttonLabels) expect(label).not.toMatch(/lift|deactivate|resume|disable stop/i);
  });
  it('requires an explicit second confirmation before calling the server', () => {
    fixture.mode = 'confirming';
    const html = renderToStaticMarkup(<AiEmergencyStopPanel />);
    expect(html).toContain('role="alertdialog"');
    expect(html).toContain('Confirm emergency stop');
    expect(html).toContain('ALL AI agents');
  });
  it('offers every canonical agent with associated labels when scoped to one agent', () => {
    fixture.mode = 'agent';
    const html = renderToStaticMarkup(<AiEmergencyStopPanel />);
    expect(html).toContain('for="ai-stop-agent"');
    expect((html.match(/<option /g) ?? []).length).toBe(61);
    expect(html).toContain('value="A60"');
  });
});
