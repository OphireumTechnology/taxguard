import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AuditCenterPanel, auditErrorText, securityVolumeErrorText } from '../components/admin/AuditCenterPanel';

// Security event volume in the audit center: shown only in the security view, with its own 31-day range message.
describe('audit center security event volume', () => {
  it('appears only in the security view', () => {
    const security = renderToStaticMarkup(<AuditCenterPanel securityOnly />);
    expect(security).toContain('Security event volume');
    expect(security).toContain('Suppressed events are duplicates the server rate-limited');
    expect(renderToStaticMarkup(<AuditCenterPanel />)).not.toContain('Security event volume');
  });
  it('explains the 31-day summary limit separately from the 92-day event-log limit', () => {
    expect(securityVolumeErrorText({ code: 'AUDIT_RANGE_INVALID', status: 400 })).toMatch(/at most 31 days/);
    expect(auditErrorText({ code: 'AUDIT_RANGE_INVALID', status: 400 })).toMatch(/92 days/);
    expect(securityVolumeErrorText({ code: 'AUDIT_ADMIN_REQUIRED', status: 403 })).toBe('The audit center is available to administrators only.');
  });
});
