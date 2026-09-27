import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Strictly filter only confirmed third-party browser extension injection noise
// Never suppress genuine application, Firebase, API, authentication, or rendering errors.
if (typeof window !== 'undefined') {
  const isConfirmedExtensionNoise = (msg: string, source: string, stack: string): boolean => {
    const text = `${msg} ${source} ${stack}`.toLowerCase();
    if (
      text.includes('/src/') ||
      text.includes('artaxserv.com') ||
      text.includes('/api/') ||
      text.includes('firebase') ||
      text.includes('firestore') ||
      text.includes('googleapis') ||
      text.includes('react')
    ) {
      return false;
    }
    const isExtensionProtocol =
      text.includes('chrome-extension://') ||
      text.includes('moz-extension://') ||
      text.includes('safari-web-extension://');
    const isKnownWalletError =
      text.includes('failed to connect to metamask') ||
      text.includes('metamask: the event') ||
      text.includes('metamask-contentscript') ||
      text.includes('evm-ask-provider');
    return isExtensionProtocol || isKnownWalletError;
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = (reason && (reason.message || String(reason))) || '';
    const stack = (reason && reason.stack) || '';
    if (isConfirmedExtensionNoise(msg, '', stack)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('error', (event) => {
    const msg = (event && (event.message || (event.error && event.error.message))) || '';
    const source = (event && event.filename) || '';
    const stack = (event && event.error && event.error.stack) || '';
    if (isConfirmedExtensionNoise(msg, source, stack)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}

const rootElem = document.getElementById('root');

createRoot(rootElem!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


