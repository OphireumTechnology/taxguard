/**
 * A/R Tax Services, LLC - Simulated Action Modal
 * Manages interactive simulated operations with clear demonstration labeling.
 */

import React, { useState } from 'react';
import { DemoEngagement, DemoInvoice, DemoRole } from '../types';
import { demoDataStore } from '../services/DemoDataService';
import { X, CheckCircle, ShieldCheck, AlertCircle, Lock } from 'lucide-react';

export type SimulatedActionType = 
  | 'sign_return' 
  | 'pay_invoice' 
  | 'file_return' 
  | 'connect_bank'
  | 'roll_forward';

interface SimulatedActionModalProps {
  actionType: SimulatedActionType;
  engagement?: DemoEngagement;
  invoice?: DemoInvoice;
  userRole: DemoRole;
  userName: string;
  onClose: () => void;
  onCompleted: () => void;
}

export const SimulatedActionModal: React.FC<SimulatedActionModalProps> = ({
  actionType,
  engagement,
  invoice,
  userRole,
  userName,
  onClose,
  onCompleted
}) => {
  const [typedSignature, setTypedSignature] = useState(userName || '');
  const [agreedConsent, setAgreedConsent] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [resultSuccess, setResultSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Simulated execution handler
  const handleExecute = async () => {
    setProcessing(true);
    setErrorMessage(null);

    // Artificial short delay to simulate cryptographic operation
    await new Promise(res => setTimeout(res, 400));

    try {
      if (actionType === 'sign_return' && engagement) {
        if (!typedSignature.trim() || !agreedConsent) {
          setErrorMessage('Please type your legal name and check the authorization acknowledgment.');
          setProcessing(false);
          return;
        }
        demoDataStore.clientSignReturn(engagement.id, typedSignature.trim());
        setResultSuccess(true);
      } else if (actionType === 'pay_invoice' && invoice) {
        demoDataStore.payInvoiceSimulated(invoice.id, userName);
        setResultSuccess(true);
      } else if (actionType === 'file_return' && engagement) {
        demoDataStore.fileReturnSimulated(engagement.id, userName, userRole);
        setResultSuccess(true);
      } else if (actionType === 'roll_forward' && engagement) {
        demoDataStore.rollForwardEngagement(engagement.id, userName, userRole);
        setResultSuccess(true);
      } else if (actionType === 'connect_bank') {
        demoDataStore.logAudit({
          user: userName,
          role: userRole,
          action: 'Connected Simulated Bank Feed',
          record: 'Institution: First Citizens Commercial Banking (Sandbox)',
          result: 'Success (Simulated)',
          reason: 'OAuth token simulated in test sandbox. No live bank credentials exchanged.'
        });
        setResultSuccess(true);
      }
    } catch {
      setErrorMessage('Operation simulation encountered an unexpected issue.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-black max-w-lg w-full p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-300 pb-3">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono uppercase bg-neutral-100 px-1.5 py-0.5 border border-neutral-300">
              Simulated Demonstration Action
            </span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-black">
              {actionType === 'sign_return' && 'Authorize Form 8879 E-Signature (Simulated)'}
              {actionType === 'pay_invoice' && 'Simulate Professional Fee Payment'}
              {actionType === 'file_return' && 'Transmit Electronic Return to IRS (Simulated)'}
              {actionType === 'connect_bank' && 'Authorize Simulated Bank Feed Sync'}
              {actionType === 'roll_forward' && 'Roll Forward Tax Engagement to Next Year'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 border border-neutral-300 hover:bg-neutral-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Persistent Banner inside action modal */}
        <div className="border border-neutral-300 bg-neutral-50 p-2.5 text-[11px] text-neutral-800 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-black">
            <AlertCircle className="w-3.5 h-3.5 text-black" />
            <span>Demonstration Notice:</span>
          </div>
          <p>
            All actions executed in this window are strictly simulated. No real legal signatures are transmitted, no real bank or credit card funds are transferred, and no actual tax filings are sent to the IRS or state tax authorities.
          </p>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="border border-black p-2 text-xs font-bold text-black bg-white">
            {errorMessage}
          </div>
        )}

        {/* Success Screen */}
        {resultSuccess ? (
          <div className="p-4 border border-black text-center space-y-3 bg-white">
            <div className="inline-flex p-2 border border-black">
              <CheckCircle className="w-6 h-6 text-black" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-black uppercase tracking-wider">
                Simulated Action Completed Successfully
              </h4>
              <p className="text-xs text-neutral-600">
                The demonstration records and practice audit trails have been updated in your session.
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => {
                  onCompleted();
                  onClose();
                }}
                className="px-5 py-2 bg-black text-white text-xs font-bold hover:bg-neutral-800"
              >
                Close &amp; Return to Dashboard
              </button>
            </div>
          </div>
        ) : (
          /* Input Screen based on Action */
          <div className="space-y-4 text-xs">
            {/* 1. SIGN RETURN */}
            {actionType === 'sign_return' && engagement && (
              <div className="space-y-3">
                <div className="p-3 border border-neutral-200 bg-neutral-50 space-y-1">
                  <div><strong>Taxpayer / Entity:</strong> {engagement.clientName} ({engagement.businessName})</div>
                  <div><strong>Tax Return:</strong> {engagement.formType} (Tax Year {engagement.taxYear})</div>
                  <div><strong>Quality Review:</strong> Certified by Elena Rostova, CPA</div>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold uppercase tracking-wider text-[11px] text-black">
                    Type Your Legal Name to Sign (Demonstration):
                  </label>
                  <input
                    type="text"
                    value={typedSignature}
                    onChange={(e) => setTypedSignature(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 font-mono text-sm focus:outline-none focus:border-black rounded-none"
                    placeholder="e.g., Michael Perotti"
                  />
                  <div className="text-[10px] text-neutral-500 italic">
                    Watermarked: &ldquo;Simulated Demonstration Signature — Not Transmitted&rdquo;
                  </div>
                </div>

                <label className="flex items-start gap-2 text-[11px] text-neutral-700 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={agreedConsent}
                    onChange={(e) => setAgreedConsent(e.target.checked)}
                    className="mt-0.5 border border-black rounded-none text-black focus:ring-0"
                  />
                  <span>
                    I confirm that I have reviewed the draft return and authorize A/R Tax Services, LLC to execute simulated electronic filing in this demonstration environment.
                  </span>
                </label>
              </div>
            )}

            {/* 2. PAY INVOICE */}
            {actionType === 'pay_invoice' && invoice && (
              <div className="space-y-3">
                <div className="p-3 border border-neutral-200 bg-neutral-50 space-y-1">
                  <div><strong>Invoice Number:</strong> {invoice.invoiceNumber}</div>
                  <div><strong>Amount Due:</strong> ${invoice.balanceDue.toFixed(2)}</div>
                  <div><strong>Client:</strong> {invoice.clientName}</div>
                </div>

                <div className="space-y-2">
                  <div className="font-bold uppercase tracking-wider text-[11px] text-black">
                    Simulated Payment Method:
                  </div>
                  <div className="p-2.5 border border-neutral-300 bg-neutral-50 font-mono text-xs text-neutral-700 flex items-center justify-between">
                    <span>Demo Card: &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; 4242</span>
                    <span className="text-[10px] font-bold uppercase border border-neutral-400 px-1">Test Sandbox</span>
                  </div>
                  <p className="text-[10px] text-neutral-500">
                    Stripe and ACH payment gateway simulation. Clicking below marks this demonstration invoice as paid without touching real accounts.
                  </p>
                </div>
              </div>
            )}

            {/* 3. FILE RETURN */}
            {actionType === 'file_return' && engagement && (
              <div className="space-y-3">
                <div className="p-3 border border-neutral-200 bg-neutral-50 space-y-1">
                  <div><strong>Return:</strong> {engagement.formType}</div>
                  <div><strong>Tax Year:</strong> {engagement.taxYear}</div>
                  <div><strong>Client Signature:</strong> Form 8879 Authorized (Simulated)</div>
                </div>
                <p className="text-xs text-neutral-700">
                  Transmit simulated XML payload to the mock IRS Modernized E-File (MeF) gateway. Immediate simulated acknowledgment will be recorded.
                </p>
              </div>
            )}

            {/* 4. CONNECT BANK */}
            {actionType === 'connect_bank' && (
              <div className="space-y-3">
                <p className="text-xs text-neutral-700">
                  Simulate an open-banking / Plaid / QuickBooks feed connection to First Citizens Commercial Banking.
                </p>
                <div className="p-3 border border-neutral-200 bg-neutral-50 text-xs font-mono">
                  Sandbox Endpoint: https://sandbox.financial-data.demo/oauth/v2
                </div>
              </div>
            )}

            {/* 5. ROLL FORWARD */}
            {actionType === 'roll_forward' && engagement && (
              <div className="space-y-3">
                <div className="p-3 border border-neutral-200 bg-neutral-50 space-y-1">
                  <div><strong>Current Engagement:</strong> {engagement.formType} (TY{engagement.taxYear})</div>
                  <div><strong>Target New Tax Year:</strong> Tax Year {engagement.taxYear + 1}</div>
                </div>
                <p className="text-xs text-neutral-700">
                  Rolling forward duplicates the client master profile, schedules, and document checklists for Tax Year {engagement.taxYear + 1}, and archives the TY{engagement.taxYear} engagement.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
              <button
                type="button"
                onClick={onClose}
                disabled={processing}
                className="px-3 py-1.5 border border-neutral-300 text-xs font-medium hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecute}
                disabled={processing}
                className="px-4 py-1.5 bg-black text-white text-xs font-bold hover:bg-neutral-800 disabled:bg-neutral-400"
              >
                {processing ? 'Processing Simulated Action...' : 'Confirm Simulated Action'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
