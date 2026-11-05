/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AppointmentTypeCode =
  | 'INITIAL_CONSULTATION'
  | 'TAX_PLANNING_SESSION'
  | 'ANNUAL_FILING_REVIEW'
  | 'AUDIT_DEFENSE_REVIEW'
  | (string & {});

export interface AvailableTimeSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  available?: boolean;
}

export interface CalendarConnection {
  id: string;
  provider: 'google' | 'microsoft' | 'apple' | string;
  email?: string;
  status: 'connected' | 'disconnected' | 'pending';
  lastSyncedAt?: string;
}
