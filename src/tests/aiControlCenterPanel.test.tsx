import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../services/api', () => ({ api: { caseAuthority: { getAiControlCenter: vi.fn(() => new Promise(() => {})) } } }));
import { AiControlCenterPanel, controlCenterErrorMessage, formatCell, parseScopedStops } from '../components/admin/AiControlCenterPanel';

describe('AI Control Center panel', () => {
  it('renders the four read-only views with a loading state and no mutation controls', () => {
    const html = renderToStaticMarkup(<AiControlCenterPanel />);
    for (const label of ['Agent registry', 'Execution history', 'Governance decisions', 'Security events']) expect(html).toContain(label);
    expect(html).toContain('role="status"');
    const labels = [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map(m => m[1].replace(/<[^>]+>/g, ''));
    for (const label of labels) expect(label).not.toMatch(/delete|disable|activate|approve|lift|edit/i);
  });
  it('offers server-validated filters for execution history and security events', () => {
    expect(renderToStaticMarkup(<AiControlCenterPanel initialView="runs" />)).toContain('value="REVIEW_REQUIRED"');
    const events = renderToStaticMarkup(<AiControlCenterPanel initialView="security-events" />);
    expect(events).toContain('value="KILL_SWITCH"');
    expect(events).toContain('value="CRITICAL"');
  });
  it('offers a usage view with only server-supported windows', () => {
    const html = renderToStaticMarkup(<AiControlCenterPanel initialView="usage" />);
    expect(html).toContain('Usage &amp; review queue');
    for (const w of ['24h', '7d', '30d']) expect(html).toContain(`value="${w}"`);
  });
  it('accepts only well-formed scoped stops for the registry banner', () => {
    expect(parseScopedStops([{ scope: 'MODEL', target: 'm@1' }, { scope: 'TOOL', target: 'document.read' }, { scope: 'GLOBAL', target: 'GLOBAL' }, { scope: 'WORKFLOW', target: 5 }, null]))
      .toEqual([{ scope: 'MODEL', target: 'm@1' }, { scope: 'TOOL', target: 'document.read' }]);
    expect(parseScopedStops(undefined)).toEqual([]);
  });
  it('formats values without inventing data', () => {
    expect(formatCell('confidence', null)).toBe('—');
    expect(formatCell('stopped', true)).toBe('STOPPED');
    expect(formatCell('stopped', false)).toBe('Not stopped');
    expect(formatCell('details', { operation: 'ACTIVATE', target: 'A07' })).toBe('operation: ACTIVATE, target: A07');
    expect(formatCell('proposed_action', { nested: 'x' })).toBe('—');
  });
  it('maps denials and shows no data on unknown failures', () => {
    expect(controlCenterErrorMessage({ code: 'AI_CONTROL_CENTER_ROLE_DENIED' })).toMatch(/not authorized/);
    expect(controlCenterErrorMessage(new Error('ECONNREFUSED 10.1.2.3'))).not.toContain('10.1.2.3');
    expect(controlCenterErrorMessage({})).toMatch(/No data is shown/);
  });
});
