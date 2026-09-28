import { resolveApiBaseUrl } from '../src/config/apiEndpoint';
// No values are printed: deployment must explicitly select its backend.
resolveApiBaseUrl(process.env.VITE_API_BASE_URL, true, false, 'https://artaxserv.com');
console.log('Production API target validated.');
