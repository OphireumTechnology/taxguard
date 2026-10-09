import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdminOperationalPanel } from '../components/admin/AdminOperationalPanel';
describe('admin operational truthfulness', () => {
  it.each(['users', 'workload', 'billing', 'jobs', 'search', 'retention', 'audit'])('shows unavailable %s integration without sample operational records', tab => {
    const html = renderToStaticMarkup(<AdminOperationalPanel tab={tab} status="ready" providers={[]} onRefresh={() => {}}/>);
    expect(html).toContain('unavailable'); expect(html).not.toContain('<table');
    for (const fabricated of ['Daniel Henze', 'Elena Rostova', 'Perotti', 'INV-2026', 'Worker Pool Active', 'sha256_82', 'Retained until 2033']) expect(html).not.toContain(fabricated);
  });
  it('distinguishes loading, failure and unknown readiness from operational success', () => {
    const render = (status: 'loading' | 'ready' | 'error') => renderToStaticMarkup(<AdminOperationalPanel tab="providers" status={status} providers={[]} onRefresh={() => {}}/>);
    expect(render('loading')).toContain('Loading'); expect(render('error')).toContain('role="alert"');
    expect(render('ready')).toContain('Readiness is unknown');
  });
  it('displays reported configuration with its limitation, table headers and timestamp', () => {
    const html = renderToStaticMarkup(<AdminOperationalPanel tab="providers" status="ready" providers={[{ provider: 'OCR', status: 'CONFIGURED', description: 'Synthetic reported configuration', lastChecked: '2026-10-09T00:00:00Z' }]} onRefresh={() => {}}/>);
    expect(html).toContain('CONFIGURED'); expect(html).toContain('does not prove connectivity');
    expect(html).toContain('scope="col"'); expect(html).toContain('<time dateTime=');
  });
});
