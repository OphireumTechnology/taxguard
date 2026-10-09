import React from 'react';

function RecordedDocuments({ documents }: { documents: any }) {
  const rows = Array.isArray(documents) ? documents : [];
  return rows.length ? <ul className="space-y-2">{rows.map((document, index) => <li key={document.id || index} className="p-3 rounded-lg bg-[#06172C]">
    <strong>{document.name || document.fileName || 'Recorded document'}</strong>
    <p>Source verification flag: {document.verified === true ? 'Recorded as verified' : 'Not recorded as verified'}</p>
  </li>)}</ul> : <p>No recorded documents in this section.</p>;
}

/** Displays recorded profile evidence without inferring consent, signature or verification authority. */
export function ProfileEvidenceSections({ section, profile, onNavigateToDocuments }: { section: string; profile: any; onNavigateToDocuments?: () => void }) {
  const identity = profile.identity || {}, engagement = profile.engagement || {}, consent = profile.consentCenter || {}, representative = profile.representative || {}, documents = profile.myDocuments || {};
  const consentFlag = (flag: unknown) => flag === true ? 'Recorded acceptance' : 'Acceptance not recorded';
  const titles: Record<string, string> = { representative: 'Recorded Representative', identity: 'Identity & Verification Records', engagement: 'Recorded Engagement', consents: 'Consent Records', documents: 'My Recorded Documents' };
  if (!titles[section]) return null;
  return <section className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 space-y-4 text-sm text-slate-300" aria-label={titles[section]}>
    <h2 className="text-base font-bold text-white">{titles[section]}</h2>
    {section === 'representative' && <><dl className="space-y-2">
      <dt>Name</dt><dd>{representative.name || 'Not recorded'}</dd>
      <dt>Capacity</dt><dd>{representative.relationshipOrCapacity || representative.title || 'Not recorded'}</dd>
      <dt>Authorization record status</dt><dd>{representative.authorizationStatus || 'Not recorded'}</dd>
    </dl><p>A recorded name or document flag does not establish power of attorney, CAF registration or signing authority.</p><RecordedDocuments documents={representative.supportingDocuments}/></>}
    {section === 'identity' && <><dl className="space-y-2">
      <dt>Recorded status</dt><dd>{identity.status || 'NOT_VERIFIED'}</dd>
      <dt>Verification timestamp</dt><dd>{identity.verifiedAt || 'Not recorded'}</dd>
      <dt>Recorded duplicate-check status</dt><dd>{identity.duplicateCheckStatus || 'Not recorded'}</dd>
    </dl><p>Onboarding completion and source document flags do not establish independent identity verification.</p><RecordedDocuments documents={identity.documents}/></>}
    {section === 'engagement' && <><dl className="space-y-2">
      <dt>Engagement identifier</dt><dd>{engagement.engagementId || 'Not recorded'}</dd>
      <dt>Tax year</dt><dd>{engagement.taxYear || 'Not recorded'}</dd>
      <dt>Agreement</dt><dd>{consentFlag(engagement.agreementAccepted)}</dd>
      <dt>Fee schedule</dt><dd>{consentFlag(engagement.feeScheduleAccepted)}</dd>
      <dt>Recorded signer</dt><dd>{engagement.signerFullName || 'Not recorded'}</dd>
      <dt>Acceptance timestamp</dt><dd>{engagement.acceptedAt || 'Not recorded'}</dd>
    </dl>{engagement.engagementTerms && <p>{engagement.engagementTerms}</p>}</>}
    {section === 'consents' && <><dl className="space-y-2">
      <dt>IRC § 7216 consent</dt><dd>{consentFlag(consent.irc7216ConsentAccepted)}</dd>
      <dt>Electronic signature consent</dt><dd>{consentFlag(consent.electronicSignatureConsentAccepted)}</dd>
      <dt>Privacy notice</dt><dd>{consentFlag(consent.privacyConsentAccepted)}</dd>
      <dt>Terms and scope</dt><dd>{consentFlag(consent.termsAndScopeAccepted)}</dd>
      <dt>Recorded version</dt><dd>{consent.consentVersion || 'Not recorded'}</dd>
      <dt>Recorded signer</dt><dd>{consent.signerFullName || 'Not recorded'}</dd>
      <dt>Signature timestamp</dt><dd>{consent.acceptedAt || 'Not recorded'}</dd>
    </dl><p>These recorded fields do not authorize additional data use, disclosure, signing or filing.</p></>}
    {section === 'documents' && <>{[
      ['Identity and formation', documents.identityDocuments], ['Authorization', documents.authorizationDocuments],
      ['Onboarding', documents.onboardingDocuments], ['Engagement', documents.engagementDocuments],
      ['Tax documents', documents.taxDocuments], ['Prior-year tax documents', documents.priorYearDocuments],
    ].map(([label, rows]) => <div key={String(label)}><h3 className="font-bold text-white">{label}</h3><RecordedDocuments documents={rows}/></div>)}
      {onNavigateToDocuments && <button type="button" className="p-2 border border-[#C6A15B] rounded-lg" onClick={onNavigateToDocuments}>Open private document workspace</button>}</>}
  </section>;
}
