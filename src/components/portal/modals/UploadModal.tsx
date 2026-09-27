import React from 'react';
import { X, UploadCloud, ShieldCheck } from 'lucide-react';
import { DocumentUpload } from '../DocumentUpload';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: string;
  defaultTaxYear?: number;
  onUploadSuccess?: (message: string) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  defaultCategory = 'w2',
  defaultTaxYear = 2025,
  onUploadSuccess
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
    >
      <div className="bg-[#0A1F38] border border-[#183458] rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 text-slate-100 relative my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#183458] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#C6A15B]/15 border border-[#C6A15B]/30 flex items-center justify-center text-[#C6A15B]">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h3 id="upload-modal-title" className="font-serif text-lg font-bold text-white">
                Upload Tax Documents
              </h3>
              <p className="text-xs text-slate-400">
                Encrypted in transit &amp; at rest &bull; IRS Circular 230 Compliant
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#132E52] transition-colors"
            aria-label="Close upload modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Embedded DocumentUpload Component */}
        <DocumentUpload
          defaultCategory={defaultCategory}
          defaultTaxYear={defaultTaxYear}
          onUploadComplete={(docMetadata) => {
            if (onUploadSuccess) {
              onUploadSuccess(`Successfully encrypted and uploaded "${docMetadata.fileName}". Processing pipeline initiated.`);
            }
          }}
        />

        {/* Footer Close */}
        <div className="flex items-center justify-end pt-2 border-t border-[#183458]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#06172C] hover:bg-[#132E52] border border-[#183458] transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
};

