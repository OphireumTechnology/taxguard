/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ClientPortalTab =
  | 'overview'
  | 'documents'
  | 'returns'
  | 'invoices'
  | 'messages'
  | 'appointments'
  | 'profile'
  | 'accounting'
  | 'strategies'
  | 'requests'
  | 'security'
  | (string & {});

export type TaxWorkspaceTab =
  | 'checklist'
  | 'stages'
  | 'workpapers'
  | 'vault'
  | 'history'
  | (string & {});

export type ProfileSecurityTab =
  | 'overview'
  | 'sessions'
  | 'mfa'
  | 'password'
  | 'logs'
  | (string & {});
