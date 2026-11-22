import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OVERVIEW_AGENTS } from '../ai/architectureOverview';
import { commissioningMatrix } from '../ai/commissioningMatrix';
import { AiArchitectureOverviewView } from '../components/admin/AiArchitectureOverviewView';

describe('TaxGuard workforce development roster', () => {
  it('preserves all design IDs and their draft deployment records', () => {
    const ids = Array.from({ length: 61 }, (_, index) => 'A' + String(index).padStart(2, '0'));
    expect(OVERVIEW_AGENTS.map(agent => agent.agent_id)).toEqual(ids);

    const rows = commissioningMatrix();
    expect(rows.map(agent => agent.agentId)).toEqual(ids);
    expect(rows.every(agent => agent.status === 'DRAFT' && agent.productionCommissioned === 'NO')).toBe(true);
    expect(rows.filter(agent => agent.handlerImplemented === 'YES').map(agent => agent.agentId)).toEqual(['A00', 'A10', 'A34']);
    expect(OVERVIEW_AGENTS.find(agent => agent.agent_id === 'A21')?.overview_name).toBe('Individual Tax Agent');
    expect(OVERVIEW_AGENTS.find(agent => agent.agent_id === 'A39')?.responsibility).toBeNull();
  });

  it('renders all 61 design rows with deployment and implementation evidence', () => {
    const view = renderToStaticMarkup(createElement(AiArchitectureOverviewView));
    const roster = view.split('</table>', 1)[0];
    expect(roster.match(/scope="row"/g)).toHaveLength(61);
    expect(roster).toContain('Implementation evidence');
    expect(roster).toContain('Deployment status');
    expect(roster).toContain('Individual Tax Agent');
    expect(roster).toContain('Government Response Agent');
    expect(roster).toContain('Bounded duplicate-hash check');
    expect(roster.match(/>DRAFT</g)).toHaveLength(61);
  });
});
