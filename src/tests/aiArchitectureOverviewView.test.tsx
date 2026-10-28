import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AiArchitectureOverviewView } from '../components/admin/AiArchitectureOverviewView';

describe('AI Control Center architecture overview view', () => {
  const html = renderToStaticMarkup(<AiArchitectureOverviewView />);

  it('states that the overview is reference only and grants nothing', () => {
    expect(html).toContain('data-testid="ai-architecture-overview-view"');
    expect(html).toContain('Reference only');
    expect(html).toContain('every agent stays DRAFT');
  });

  it('lists all 61 agents with the overview name next to the registry name', () => {
    const [agents, page9] = html.split('id="ai-overview-page9"');
    expect(agents.match(/<th scope="row"[^>]*>A\d\d<\/th>/g)).toHaveLength(61);
    expect(page9.match(/<th scope="row"[^>]*>A\d\d<\/th>/g)).toHaveLength(13);
    expect(html).toContain('Form Mapping Agent');
    expect(html).toContain('CLIENT SERVICES 01');
    expect(html).toContain('Not on page 2');
  });

  it('shows the open decisions and the narrowed page-9 ceiling', () => {
    expect(html).toContain('Owner decisions (13)');
    expect(html).toMatch(/Open owner decisions<\/dt><dd[^>]*>10 \/ 13</);
    expect(html.match(/data-decision-status="DECIDED"/g)).toHaveLength(3);
    expect(html).toContain('Owner, 2026-10-28: always human review.');
    expect(html).toContain('A44 Appointment Agent lists');
    expect(html).toContain('Page 9 example permissions');
    expect(html).toMatch(/Not allowed \(drawn: allowed\)/);
    expect(html).toMatch(/Not allowed \(drawn: unreadable\)/);
  });

  it('labels its tables for assistive technology', () => {
    expect(html).toContain('<caption class="sr-only">Architecture overview record for each canonical agent</caption>');
    expect(html).toContain('<caption class="sr-only">Page 9 example permissions after TaxGuard&#x27;s human-only limits</caption>');
  });
});
