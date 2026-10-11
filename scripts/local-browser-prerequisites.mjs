/** Pure prerequisite assessment only; never certifies a build or any product journey. */
export function assessLocalBrowserPrerequisites(packageInstalled, artifactHTML) {
  const blockers = [];
  if (packageInstalled !== true) blockers.push('PLAYWRIGHT_PACKAGE_MISSING');
  if (typeof artifactHTML !== 'string' || !artifactHTML) blockers.push('SYNTHETIC_ARTIFACT_MISSING');
  else if (artifactHTML.length > 1048576 || !artifactHTML.includes('TaxGuard synthetic shell QA')
    || !/connect-src\s+'none'/.test(artifactHTML) || !/form-action\s+'none'/.test(artifactHTML)) {
    blockers.push('SYNTHETIC_ARTIFACT_POLICY_INVALID');
  }
  return { status: blockers.length ? 'BLOCKED' : 'PREREQUISITES_PRESENT_ONLY', blockers,
    browserAcceptance: 'NOT VERIFIED', releaseAuthorized: false };
}
