import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { StageTenApproveView } from '../components/portal/views/stages/StageTenApproveView';
import { StageSeventeenRenewView } from '../components/portal/views/stages/StageSeventeenRenewView';
import { ClientStageReadUnavailable, unavailableClientStage } from '../components/portal/views/stages/ClientStageReadUnavailable';

describe('uncommissioned client stage actions', () => {
  it.each(['stage_04', 'stage_05', 'stage_06', 'review', 'stage_07', 'stage_08', 'stage_09', 'tax_prep', 'stage_14', 'stage_15', 'completed', 'stage_16', 'stage_18'])('keeps unsupported %s read surfaces unavailable without inferred scope', nav => {
    expect(unavailableClientStage(nav)).toBeDefined();
    const html = renderToStaticMarkup(<ClientStageReadUnavailable nav={nav} taxYear={2025}/>);
    expect(html).toContain('role="status"');
    expect(html).toContain('unavailable');
    for (const claim of ['tenantA', 'Elena Rostova', '11,400', 'April 15', '0 Active Exceptions', 'IN_REVIEW']) expect(html).not.toContain(claim);
  });
  it.each(['stage_01', 'stage_02', 'stage_03', 'stage_10', 'stage_11', 'stage_12', 'stage_13', 'stage_17', 'documents'])('retains independent route %s', nav => {
    expect(unavailableClientStage(nav)).toBeUndefined();
  });
  it('cannot offer local approval or fabricate return results', () => {
    const refresh = vi.fn();
    const html = renderToStaticMarkup(<StageTenApproveView clientId="synthetic" selectedTaxYear={2025} onServerWorkflowRefresh={refresh}/>);
    expect(html).toContain('disabled=""');
    expect(html).toContain('approval is unavailable');
    for (const claim of ['Taxpayer Approval Recorded', 'Refund Anticipated', 'Verified by Preparer', 'Balanced / Clean', 'type="checkbox"']) expect(html).not.toContain(claim);
    expect(refresh).not.toHaveBeenCalled();
  });
  it('cannot commission a year locally or report completed carryforward', () => {
    const commission = vi.fn();
    const html = renderToStaticMarkup(<StageSeventeenRenewView clientId="synthetic" selectedTaxYear={2025} onCommissionNewTaxYear={commission}/>);
    expect(html).toContain('disabled=""');
    expect(html).toContain('renewal is unavailable');
    expect(html).not.toContain('Engagement Commissioned');
    expect(html).not.toContain('type="checkbox"');
    expect(commission).not.toHaveBeenCalled();
  });
});
