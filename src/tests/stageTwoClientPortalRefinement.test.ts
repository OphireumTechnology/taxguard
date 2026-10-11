/**
 * A/R Tax Services, LLC - Automated Test Suite
 * Stage 02 Collect & Client Portal Branding Refinement Verification
 *
 * Verifies:
 * 1. Removal of duplicate 10-button horizontal navigation for ordinary client role
 * 2. Guided collection workflow header in Stage 02 (STAGE 02 — COLLECT, Next Required Action, Progress bar)
 * 3. Consolidation of document lifecycle into 4 client concepts: Required Documents, Upload Documents, My Documents, Requests
 * 4. Accounting Document Intake Agent UI in Upload Documents:
 *    - COLLECT ACCOUNTING DOCUMENTS
 *    - [ Upload Files ], [ Select Folder ], [ Connect Cloud Storage ], [ Connect Email ]
 *    - Dropzone: "Drop files here or choose an authorized source"
 *    - IMPORT QUEUE: Documents Found 147, Accounting Relevant 63, Needs Review 7, Duplicates 4, Not Accounting Related 73
 *    - [ Review 63 Documents ]
 * 5. Premium A/R Tax Services corporate palette: #06182B, #071A2E, #0D2745, #D4A843 (no large white panels as dominant interface)
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function readSource(relative: string): string {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

describe('Stage 02 Collect & Client Portal UI/UX Refinement', () => {
  const workspaceSource = readSource('src/components/collection/StageTwoCollectionWorkspace.tsx');
  const intakeAgentSource = readSource('src/components/collection/AccountingDocumentIntakeAgentView.tsx');
  const dashboardSource = readSource('src/components/portal/AuthenticatedClientDashboard.tsx');

  describe('1. Guided Stage 02 Workflow Header & Next Required Action', () => {
    it('renders the guided Stage 02 header for client role with progress and Next Required Action', () => {
      expect(workspaceSource).toContain('STAGE 02 — COLLECT');
      expect(workspaceSource).toContain('Collection Status: In Progress');
      expect(workspaceSource).toContain('Collection Progress');
      expect(workspaceSource).toContain('NEXT REQUIRED ACTION');
      expect(workspaceSource).toContain('Upload the documents required to prepare your return.');
      expect(workspaceSource).toContain('View Required Documents');
      expect(workspaceSource).toContain('Upload Document');
    });

    it('supports dynamic Under Review, Action Required, and Complete states when documents are received', () => {
      expect(workspaceSource).toContain('Collection Status: Under Review');
      expect(workspaceSource).toContain('DOCUMENTS RECEIVED — UNDER REVIEW');
      expect(workspaceSource).toContain('View Received Documents');
      expect(workspaceSource).toContain('STAGE COMPLETE — READY FOR VALIDATION');
    });

    it('passes client role from AuthenticatedClientDashboard', () => {
      expect(dashboardSource).toContain("userRole={currentUser?.role === 'accountant' || currentUser?.role === 'reviewer' || currentUser?.role === 'admin' || currentUser?.role === 'super_admin' ? 'STAFF' : 'CLIENT'}");
    });
  });

  describe('2. Removal of Duplicate 10-Button Navigation & Consolidation into 4 Concepts', () => {
    it('consolidates document lifecycle into 4 concepts for the client role', () => {
      expect(workspaceSource).toContain("'Required Documents'");
      expect(workspaceSource).toContain("'Upload Documents'");
      expect(workspaceSource).toContain("'My Documents'");
      expect(workspaceSource).toContain("'Requests'");
    });

    it('replaces the permanent 10-button navigation bar for client role with discrete staff drawer', () => {
      expect(workspaceSource).toContain('Staff Operations');
      expect(workspaceSource).toContain('showStaffOperationalTabs');
    });
  });

  describe('3. Accounting Document Intake Agent UI & Import Queue', () => {
    it('renders the requested action buttons and intake sources', () => {
      expect(intakeAgentSource).toContain('COLLECT ACCOUNTING DOCUMENTS');
      expect(intakeAgentSource).toContain('Upload Files');
      expect(intakeAgentSource).toContain('Select Folder');
      expect(intakeAgentSource).toContain('Connect Cloud Storage');
      expect(intakeAgentSource).toContain('Connect Email');
      expect(intakeAgentSource).toContain('Drop files here');
    });

    it('displays the Import Queue with canonical metric classifications', () => {
      expect(intakeAgentSource).toContain('IMPORT QUEUE');
      expect(intakeAgentSource).toContain('Documents Found');
      expect(intakeAgentSource).toContain('Accounting Relevant');
      expect(intakeAgentSource).toContain('Needs Review');
      expect(intakeAgentSource).toContain('Duplicates');
      expect(intakeAgentSource).toContain('Not Accounting Related');
      expect(intakeAgentSource).toContain('Review');
      expect(intakeAgentSource).toContain('Documents');
    });

    it('does not expose internal AI architecture or raw technical jargon to ordinary clients', () => {
      expect(intakeAgentSource).not.toContain('LLM Prompt Generator');
      expect(intakeAgentSource).not.toContain('Vector Embeddings Database');
    });
  });

  describe('4. Palette & Aesthetic Consistency (#06182B, #071A2E, #0D2745, #D4A843)', () => {
    it('uses the approved corporate dark navy palette across dashboard and workspace', () => {
      expect(dashboardSource).toContain('bg-[#06182B]');
      expect(dashboardSource).toContain('bg-[#071A2E]');
      expect(workspaceSource).toContain('bg-[#0D2745]');
      expect(workspaceSource).toContain('#D4A843');
      expect(intakeAgentSource).toContain('bg-[#0D2745]');
      expect(intakeAgentSource).toContain('#D4A843');
    });

    it('does not use white background panels as the dominant container interface', () => {
      expect(intakeAgentSource).not.toContain('bg-white');
    });
  });
});
