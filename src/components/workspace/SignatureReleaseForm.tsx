import { useEffect, useRef, useState } from 'react';
import { signaturePackageText, taxEngineMessage, taxEngineService, type SignatureContext } from '../../services/taxEngineService';

/**
 * Stage 11 signature package (Block 74, proposal 20261019190000): release an authorized, current return version for client
 * signature, or withdraw a released package. The practice's consent text is shown and must be acknowledged; no signer is
 * pre-selected. Releasing needs a recent multi-factor sign-in. Nothing is rendered, sent or signed, and nothing is filed:
 * electronic signing is not available.
 */
export function SignatureReleaseForm({ returnVersionId, name }: { returnVersionId: string; name: string }) {
  const [ctx, setCtx] = useState<{ data?: SignatureContext; message?: string }>({});
  const [signers, setSigners] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const live = useRef(returnVersionId); live.current = returnVersionId;

  const load = (): Promise<string | null> => {
    const key = returnVersionId;
    return taxEngineService.signatureContext(returnVersionId).then(data => { if (live.current === key) setCtx({ data }); return null; })
      .catch(e => { const message = taxEngineMessage(e); if (live.current === key) setCtx({ message }); return message; });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setCtx({}); setSigners([]); setAcknowledged(false); setReason(''); setNotice(null); void load(); }, [returnVersionId]);

  const run = async (work: () => Promise<unknown>, text: string) => {
    if (busy) return;
    setBusy(true); setNotice(null);
    try {
      await work();
      setSigners([]); setAcknowledged(false); setReason('');
      const failure = await load();
      setNotice(failure === null ? { error: false, text } : { error: true, text: `${text} The status could not be refreshed: ${failure}` });
    } catch (e) { setNotice({ error: true, text: taxEngineMessage(e) }); }
    finally { setBusy(false); }
  };

  if (ctx.message) return <p role="alert">{ctx.message}</p>;
  const data = ctx.data;
  if (!data) return <p role="status">Loading the signature status…</p>;
  const pkg = data.readiness.signaturePackage?.package ?? null;
  const ackId = `signature-ack-${returnVersionId}`, reasonId = `signature-reason-${returnVersionId}`;
  const canRelease = !busy && acknowledged && signers.length > 0 && data.releasable.releasable && !!data.consent && !pkg;
  return <form aria-label={`Signature package for ${name}`} onSubmit={e => e.preventDefault()}>
    <div role="status" aria-label="Signature package result">{notice && !notice.error && <p>{notice.text}</p>}</div>
    {notice?.error && <p role="alert">{notice.text}</p>}
    <p>Stage 11: {signaturePackageText(data.readiness)}.</p>
    {pkg ? <>
      <p>Released by {pkg.releasedBy} for {pkg.signerUids.join(', ')} under consent version {pkg.consentVersion}.</p>
      <label htmlFor={reasonId}>Reason for withdrawing (recorded)</label>
      <input id={reasonId} value={reason} onChange={e => setReason(e.target.value)} />
      <button type="button" disabled={busy} onClick={() => void run(() => taxEngineService.withdrawSignaturePackage(returnVersionId, reason.trim()),
        `Signature package for ${name} withdrawn.`)}>Withdraw signature package of {name}</button>
    </> : !data.consent ? <p role="alert">The practice has no approved signature consent text, so {name} cannot be released for signature.</p> : <>
      <blockquote aria-label={`Consent version ${data.consent.consentVersion}`}>{data.consent.text}</blockquote>
      <fieldset>
        <legend>Signers for {name}</legend>
        {data.candidates.length === 0 && <p>This client has no active client-portal member to sign.</p>}
        {data.candidates.map(c => <label key={c.uid}><input type="checkbox" checked={signers.includes(c.uid)}
          onChange={e => setSigners(s => e.target.checked ? [...s, c.uid] : s.filter(x => x !== c.uid))} /> {c.name ?? c.uid} ({c.uid})</label>)}
      </fieldset>
      <label htmlFor={ackId}><input id={ackId} type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} /> I have read consent
        version {data.consent.consentVersion} and checked the signers of {name}.</label>
      <button type="button" disabled={!canRelease} onClick={() => void run(() => taxEngineService.releaseSignaturePackage(returnVersionId,
        { consentVersion: data.consent!.consentVersion, acknowledged: true, signers }), `${name} released for client signature. Electronic signing is not available yet; nothing has been signed or filed.`)}>
        Release {name} for signature</button>
      <p>Releasing needs a recent multi-factor sign-in. It does not send, sign or file the return.</p>
    </>}
  </form>;
}
