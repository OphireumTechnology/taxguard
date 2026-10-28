import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { FixtureSelect } from '../../qa/synthetic-shell/FixtureSelect';

const roles = ['client', 'accountant', 'reviewer', 'bookkeeper', 'practice_manager', 'operations', 'admin'];
it.each(roles)('keeps exact fixture labels independent of option text for %s', role => {
  for (const [id, label] of [['fixture-role', 'Fixture role'], ['fixture-workspace', 'Requested workspace']]) {
    const html = renderToStaticMarkup(<FixtureSelect id={id} label={label} value={role} options={roles} onChange={() => {}} />);
    expect(html).toContain(`<label for="${id}">${label}</label><select id="${id}">`);
    expect(html).toContain(`<option value="${role}" selected="">${role}</option>`);
    expect(html.match(/<label\b/g)).toHaveLength(1);
    expect(html).not.toMatch(/<label[^>]*>[^<]*<select/);
  }
});
it('associates the responsive width selector with a text-only label', () => {
  const html = renderToStaticMarkup(<FixtureSelect id="fixture-width" label="Fixture width" value="mobile" options={['desktop', 'tablet', 'mobile']} onChange={() => {}} />);
  expect(html).toContain('<label for="fixture-width">Fixture width</label><select id="fixture-width">');
  expect(html).toContain('<option value="mobile" selected="">mobile</option>');
});
