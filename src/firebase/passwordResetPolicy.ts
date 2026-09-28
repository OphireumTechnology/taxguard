export function passwordResetSettings(continueUrl?: string) {
  // Default Firebase-hosted handler needs no continue URL/domain override.
  if (!continueUrl?.trim()) return undefined;
  const url = new URL(continueUrl);
  if (url.protocol !== 'https:' || !['artaxserv.com', 'www.artaxserv.com'].includes(url.hostname) ||
      url.username || url.password || url.search || url.pathname !== '/' || url.hash !== '#/client/login') {
    throw new Error('Invalid password reset continuation configuration.');
  }
  return { url: url.href, handleCodeInApp: false };
}
