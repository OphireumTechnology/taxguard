import React, { useCallback, useEffect, useState } from 'react';
import { onboardingApi, onboardingMessage, type OnboardingFields, type OnboardingView } from '../../services/onboardingApi';

/**
 * Durable Stage 01 onboarding for a signed-in client. The server holds the record, derives every requirement
 * (including the practice-verified identity document and the approved consent version) and decides nothing on
 * the browser's word: this screen only edits facts and submits them for staff review.
 */
const STATUS_TEXT: Record<OnboardingView['status'], string> = {
  DRAFT: 'Not submitted yet',
  SUBMITTED: 'Submitted. The practice is reviewing your onboarding.',
  CHANGES_REQUESTED: 'The practice asked for changes. Update your details and submit again.',
  APPROVED: 'Onboarding approved. Document collection (Stage 02) is open.',
};
const REQUIREMENTS: Array<[keyof OnboardingView['requirements'], string]> = [
  ['profile', 'Taxpayer type and legal name'], ['tin', 'Identification number type and last four digits'], ['address', 'Address'],
  ['representative', 'Authorized representative (entities)'], ['identityDocument', 'Identification document verified by the practice'],
  ['consentAvailable', 'Approved IRC § 7216 consent wording available'],
];
const input = 'w-full rounded-md border border-slate-600 bg-[#0B1F36] px-3 py-2 text-sm text-white';

export const DurableStageOnePanel: React.FC<{ onApproved?: () => void }> = ({ onApproved }) => {
  const [view, setView] = useState<OnboardingView | null>(null);
  const [form, setForm] = useState<OnboardingFields>({});
  const [agree, setAgree] = useState(false);
  const [signer, setSigner] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);

  const adopt = useCallback((v: OnboardingView) => {
    setView(v);
    setForm({ taxpayerType: v.taxpayerType ?? '', legalName: v.legalName ?? '', street: v.address.street ?? '', city: v.address.city ?? '', state: v.address.state ?? '',
      postalCode: v.address.postalCode ?? '', repName: v.representative?.fullName ?? '', repTitle: v.representative?.title ?? '', tinType: v.tinType ?? '', tinLast4: '' });
  }, []);
  const load = useCallback(() => {
    onboardingApi.mine().then(adopt).catch(e => setNotice({ error: true, text: onboardingMessage(e) }));
  }, [adopt]);
  useEffect(() => { load(); }, [load]);

  if (!view) {
    return <div role="status" className="max-w-3xl mx-auto p-8 text-slate-300">{notice?.text ?? 'Loading your onboarding record…'}</div>;
  }
  const editable = view.status === 'DRAFT' || view.status === 'CHANGES_REQUESTED';
  const set = (key: keyof OnboardingFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: e.target.value });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setNotice(null);
    const fields: OnboardingFields = { ...form };
    if (!fields.tinLast4) delete fields.tinLast4; // keep the stored last four unless a new value was entered
    if (fields.taxpayerType !== 'entity') { fields.repName = ''; fields.repTitle = ''; }
    try { adopt(await onboardingApi.save(view.revision, fields)); setNotice({ error: false, text: 'Your onboarding details were saved.' }); }
    catch (err) { setNotice({ error: true, text: onboardingMessage(err) }); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    if (!view.consent) return;
    setBusy(true); setNotice(null);
    try { adopt(await onboardingApi.submit(view.revision, view.consent.version, signer)); setAgree(false); setNotice({ error: false, text: 'Submitted for practice review.' }); }
    catch (err) { setNotice({ error: true, text: onboardingMessage(err) }); }
    finally { setBusy(false); }
  };
  const ready = view.requirements.profile && view.requirements.tin && view.requirements.address && view.requirements.representative;

  return (
    <section aria-labelledby="durable-stage-one-title" className="max-w-4xl mx-auto px-4 py-8 space-y-6 text-slate-100">
      <header className="space-y-1">
        <h2 id="durable-stage-one-title" className="text-xl font-bold text-white">Stage 01 onboarding</h2>
        <p className="text-sm text-slate-300">Client ID: <span className="font-mono">{view.clientId}</span></p>
        <p role="status" className="text-sm font-semibold text-[#D4A843]">{STATUS_TEXT[view.status]}</p>
        {view.status === 'CHANGES_REQUESTED' && view.clientReason && <p className="text-sm text-amber-200">Practice note: {view.clientReason}</p>}
      </header>

      <section aria-labelledby="stage-one-requirements" className="rounded-xl border border-slate-700 p-4">
        <h3 id="stage-one-requirements" className="font-semibold text-white">Requirements</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {REQUIREMENTS.map(([key, label]) => <li key={key}>{view.requirements[key] ? '✓' : '○'} {label}<span className="sr-only">{view.requirements[key] ? ' (complete)' : ' (outstanding)'}</span></li>)}
        </ul>
        {!view.requirements.identityDocument && <p className="mt-2 text-xs text-slate-400">Upload a government-issued identification document under Documents. The practice verifies it.</p>}
      </section>

      {editable ? (
        <form aria-label="Onboarding details" onSubmit={save} className="grid gap-4 rounded-xl border border-slate-700 p-4 sm:grid-cols-2">
          <label className="text-sm">Taxpayer type
            <select required className={input} value={form.taxpayerType} onChange={set('taxpayerType')}>
              <option value="">Select</option><option value="individual">Individual or household</option><option value="entity">Business entity</option>
            </select></label>
          <label className="text-sm">Legal name<input required autoComplete="name" className={input} value={form.legalName} onChange={set('legalName')} maxLength={255} /></label>
          <label className="text-sm">Identification number type
            <select required className={input} value={form.tinType} onChange={set('tinType')}>
              <option value="">Select</option><option value="SSN">SSN</option><option value="ITIN">ITIN</option><option value="EIN">EIN</option>
            </select></label>
          <label className="text-sm">Last four digits
            <input className={input} inputMode="numeric" autoComplete="off" pattern="[0-9]{4}" maxLength={4} aria-describedby="tin-help"
              placeholder={view.tinMasked ?? ''} value={form.tinLast4} onChange={set('tinLast4')} />
            <span id="tin-help" className="block text-xs text-slate-400">Enter only the last four digits. Never enter the full number.</span></label>
          <label className="text-sm sm:col-span-2">Street address<input required autoComplete="street-address" className={input} value={form.street} onChange={set('street')} maxLength={255} /></label>
          <label className="text-sm">City<input required autoComplete="address-level2" className={input} value={form.city} onChange={set('city')} maxLength={128} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">State<input required autoComplete="address-level1" className={input} value={form.state} onChange={set('state')} maxLength={2} /></label>
            <label className="text-sm">ZIP code<input required autoComplete="postal-code" inputMode="numeric" className={input} value={form.postalCode} onChange={set('postalCode')} maxLength={10} /></label>
          </div>
          {form.taxpayerType === 'entity' && <>
            <label className="text-sm">Authorized representative<input required className={input} value={form.repName} onChange={set('repName')} maxLength={255} /></label>
            <label className="text-sm">Representative title<input required className={input} value={form.repTitle} onChange={set('repTitle')} maxLength={128} /></label>
          </>}
          <div className="sm:col-span-2"><button type="submit" disabled={busy} className="rounded-lg bg-[#D4A843] px-4 py-2 text-sm font-bold text-[#071A2E] disabled:opacity-50">Save details</button></div>
        </form>
      ) : (
        <dl className="grid gap-2 rounded-xl border border-slate-700 p-4 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-400">Legal name</dt><dd>{view.legalName}</dd></div>
          <div><dt className="text-slate-400">Identification number</dt><dd>{view.tinType} {view.tinMasked}</dd></div>
          <div className="sm:col-span-2"><dt className="text-slate-400">Address</dt><dd>{[view.address.street, view.address.city, view.address.state, view.address.postalCode].filter(Boolean).join(', ')}</dd></div>
          {view.consentVersion && <div className="sm:col-span-2"><dt className="text-slate-400">Consent</dt><dd>Version {view.consentVersion}, signed by {view.consentSigner}</dd></div>}
        </dl>
      )}

      {editable && (
        <section aria-labelledby="stage-one-consent" className="rounded-xl border border-slate-700 p-4 space-y-3">
          <h3 id="stage-one-consent" className="font-semibold text-white">IRC § 7216 consent</h3>
          {view.consent ? <>
            <div tabIndex={0} aria-label={`Consent wording, version ${view.consent.version}`} className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-[#0B1F36] p-3 text-xs text-slate-200">{view.consent.text}</div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} /> I have read and agree to this consent (version {view.consent.version})</label>
            <label className="block text-sm">Full name of the person signing<input className={input} value={signer} onChange={e => setSigner(e.target.value)} maxLength={255} autoComplete="name" /></label>
            <button type="button" onClick={() => void submit()} disabled={busy || !agree || signer.trim().length < 3 || !ready}
              className="rounded-lg bg-[#D4A843] px-4 py-2 text-sm font-bold text-[#071A2E] disabled:opacity-50">Submit for practice review</button>
            {!ready && <p className="text-xs text-slate-400">Save every section above before submitting.</p>}
          </> : <p role="note" className="text-sm text-amber-200">The practice's IRC § 7216 consent wording is awaiting approval. You can save your details now, but onboarding cannot be submitted until approved wording is available.</p>}
        </section>
      )}

      {view.status === 'APPROVED' && onApproved && <button type="button" onClick={onApproved} className="rounded-lg bg-[#D4A843] px-4 py-2 text-sm font-bold text-[#071A2E]">Continue to Stage 02</button>}
      {notice && <p role={notice.error ? 'alert' : 'status'} className={notice.error ? 'text-sm text-rose-300' : 'text-sm text-emerald-300'}>{notice.text}</p>}
    </section>
  );
};
