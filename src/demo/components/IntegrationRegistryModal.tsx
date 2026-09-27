/**
 * A/R Tax Services, LLC - Future Integrations Registry
 * Documents external planned services, all strictly maintained in "Not Configured" status.
 */

import React from 'react';
import { FUTURE_INTEGRATION_REGISTRY } from '../mockData';
import { X, ShieldCheck, Key, RefreshCw, AlertCircle } from 'lucide-react';

interface IntegrationRegistryModalProps {
  onClose: () => void;
}

export const IntegrationRegistryModal: React.FC<IntegrationRegistryModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-black max-w-4xl w-full max-h-[90vh] flex flex-col p-6 space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-neutral-300 pb-3 flex-shrink-0">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-black">
              Enterprise Integration Registry &amp; Architecture Roadmap
            </h2>
            <p className="text-xs text-neutral-600">
              External service connectivity status. In this demonstration environment, all external integrations are strictly isolated and unconfigured.
            </p>
          </div>
          <button onClick={onClose} className="p-1 border border-neutral-300 hover:bg-neutral-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Integration Registry Table */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
          {FUTURE_INTEGRATION_REGISTRY.map((item) => (
            <div key={item.id} className="border border-neutral-300 p-4 space-y-2.5 bg-white">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 pb-2">
                <div>
                  <span className="text-[10px] font-mono uppercase bg-neutral-100 px-1.5 py-0.5 border border-neutral-300 mr-2">
                    {item.category}
                  </span>
                  <strong className="text-xs text-black">{item.name}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <span className="border border-black px-2 py-0.5 font-bold uppercase text-[10px] bg-neutral-100 text-black">
                    Status: {item.currentStatus}
                  </span>
                  <span className="text-[10px] font-mono text-neutral-500">
                    {item.productionReadiness}
                  </span>
                </div>
              </div>

              <p className="text-xs text-neutral-700">
                <strong>Business Purpose:</strong> {item.businessPurpose}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] bg-neutral-50 p-2.5 border border-neutral-200">
                <div>
                  <span className="font-semibold text-black">Required Credentials:</span>
                  <div className="font-mono text-[10px] text-neutral-600 mt-0.5">
                    {item.requiredCredentials.join(', ')}
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-black">Authorization Standard:</span>
                  <div className="text-neutral-600 mt-0.5">{item.requiredAuthorization}</div>
                </div>
                <div>
                  <span className="font-semibold text-black">Data Exchanged:</span>
                  <div className="text-neutral-600 mt-0.5">{item.dataExchanged}</div>
                </div>
                <div>
                  <span className="font-semibold text-black">Webhook Architecture:</span>
                  <div className="text-neutral-600 mt-0.5">{item.webhookRequirement}</div>
                </div>
              </div>

              <div className="text-[10px] text-neutral-500 flex items-center justify-between pt-1">
                <span>Security Review: {item.securityReviewStatus}</span>
                <span className="font-mono">ID: {item.id}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-neutral-300 pt-3 flex items-center justify-between flex-shrink-0">
          <div className="text-[11px] text-neutral-500">
            Total Integrated Services: <strong>0 active</strong> • <strong>{FUTURE_INTEGRATION_REGISTRY.length} planned future connectors</strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-black text-white text-xs font-bold hover:bg-neutral-800"
          >
            Close Registry
          </button>
        </div>
      </div>
    </div>
  );
};
