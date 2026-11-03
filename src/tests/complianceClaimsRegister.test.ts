import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// Block 109: statements that claim compliance or government authorization must be on the review register. This does not
// decide whether a claim is true: that takes evidence and legal review. A new claim fails here until it is recorded, and a
// removed claim fails until the register shrinks, so docs/development/compliance-claims-review.md stays accurate.
const REGISTER = JSON.parse(fs.readFileSync('docs/development/compliance-claims-register.json', 'utf8')) as { claims: { file: string; count: number; category: string; status: string }[] };
const CLAIM = /circular 230[^.<\n]{0,45}(compliant|protected)|(compliant|adhering|adheres)[^.<\n]{0,45}circular 230|pub(lication)? 4557 compliant|§ ?7216[^.<\n]{0,20}(protected|compliant)|irs authorized e-file|irs (approved|certified)/gi;
const IN_SCOPE = (file: string) => /\.(ts|tsx)$/.test(file) && !/^src\/(tests|tests-e2e)\//.test(file);
const found = () => {
  const out: Record<string, number> = {};
  for (const file of execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8' }).split('\n').filter(IN_SCOPE)) {
    if (!fs.existsSync(file)) continue;
    const count = fs.readFileSync(file, 'utf8').match(CLAIM)?.length ?? 0;
    if (count) out[file] = count;
  }
  return out;
};

describe('compliance claims register', () => {
  it('lists exactly the claims in the source', () => {
    expect(Object.fromEntries(REGISTER.claims.map(c => [c.file, c.count]))).toEqual(found());
  });
  it('treats every recorded claim as unsubstantiated until evidence is on file', () => {
    for (const claim of REGISTER.claims) expect(claim.status, claim.file).toBe('FLAGGED_NOT_SUBSTANTIATED');
  });
  it('keeps the written review beside the register, covering every file', () => {
    const review = fs.readFileSync('docs/development/compliance-claims-review.md', 'utf8');
    expect(review).toContain('before public deployment');
    expect(review).toContain('not legal advice');
    for (const claim of REGISTER.claims) expect(review, claim.file).toContain(claim.file.replace('src/components/', '').replace('src/', ''));
  });
  it('allows no flagged claim on a public page without evidence and compliance approval', () => {
    const isPublic = (file: string) => /^src\/components\/(public|layout\/Public)|\/(Navbar|Footer|SEOHead)\.tsx$/.test(file);
    expect(Object.keys(found()).filter(isPublic)).toEqual([]);
  });
  it('records no decision until a person has made one', () => {
    for (const claim of REGISTER.claims) expect((claim as any).decision, claim.file).toBe('PENDING_OWNER_AND_COMPLIANCE_REVIEW');
    expect((REGISTER as any).claim_count).toBe(REGISTER.claims.reduce((sum, c) => sum + c.count, 0));
  });
  it('still shows the e-file provider claim to be unsupported by the product itself', () => {
    expect(fs.readFileSync('src/taxForms/capabilities.ts', 'utf8')).toContain('no e-file transmitter is integrated');
  });
});
