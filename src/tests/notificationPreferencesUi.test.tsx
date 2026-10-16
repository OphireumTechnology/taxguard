import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PreferencesBody, preferenceErrorText } from '../components/portal/dashboard/ClientNotificationPreferencesPanel';
import type { NotificationPreferences } from '../services/documentRequestService';

// Contract C6 preference view (synthetic): required notices are locked, e-mail and SMS are not offered.
const prefs = (remindersOn = true): NotificationPreferences => ({ channels: { IN_APP: 'AVAILABLE', EMAIL: 'NOT_COMMISSIONED', SMS: 'NOT_COMMISSIONED' },
  categories: [{ category: 'DOCUMENT_REQUESTS', mandatory: true, inApp: true, version: 0 }, { category: 'DOCUMENT_REMINDERS', mandatory: false, inApp: remindersOn, version: 1 },
    { category: 'ACCOUNT_SECURITY_LEGAL', mandatory: true, inApp: true, version: 0 }] });
const html = (p: NotificationPreferences, hidden = 0) => renderToStaticMarkup(<PreferencesBody prefs={p} hidden={hidden} busy={false} onToggle={() => undefined} />);

describe('notification preferences view', () => {
  it('locks required notices and leaves only reminders adjustable', () => {
    const out = html(prefs());
    expect(out.match(/disabled=""/g)).toHaveLength(2);
    expect(out).toContain('Required');
    expect(out).toContain('Reminders');
  });
  it('never offers e-mail or text delivery', () => {
    const out = html(prefs());
    expect(out).toContain('E-mail: not offered — no messages are sent this way');
    expect(out).toContain('Text message: not offered');
    expect(out).not.toMatch(/(E-mail|Text message): available/);
  });
  it('says how many reminders are hidden and explains refusals', () => {
    expect(html(prefs(false), 2)).toContain('2 reminders are hidden by your preference.');
    expect(html(prefs(false), 0)).not.toContain('hidden by');
    expect(preferenceErrorText('NOTIFICATION_CATEGORY_MANDATORY')).toMatch(/required/);
    expect(preferenceErrorText('NOTIFICATION_PREF_VERSION_CONFLICT')).toMatch(/reloaded/);
    expect(preferenceErrorText()).toMatch(/did not confirm/);
  });
});
