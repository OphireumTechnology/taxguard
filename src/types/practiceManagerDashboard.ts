/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PracticeManagerCase {
  id: string;
  status: string;
  dueDates: string[];
  waiting: boolean;
  review: boolean;
  owners: string[];
  stage: number;
  updatedAt?: string;
  clientName?: string;
  serviceTitle?: string;
}

export interface PracticeManagerDeadline {
  id?: string;
  status: string;
  escalation: number;
  dueDate?: string;
  clientName?: string;
}

export interface PracticeManagerStaff {
  id: string;
  name: string;
  role?: string;
  assigned?: number;
  due?: number;
  overdue?: number;
  review?: number;
}

export interface PracticeManagerSnapshot {
  cases: PracticeManagerCase[];
  deadlines: PracticeManagerDeadline[];
  staff: PracticeManagerStaff[];
}
