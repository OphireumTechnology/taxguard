import React, { useState } from 'react';
import { X, Camera, RefreshCw, CheckCircle, ShieldCheck, AlertCircle } from 'lucide-react';

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageDataUrl: string) => void;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  isOpen,
  onClose,
  onCapture
}) => {
  const [captured, setCaptured] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [guidanceTip, setGuidanceTip] = useState('Align document borders within the frame');

  if (!isOpen) return null;

  const handleSimulateCapture = () => {
    setCapturing(true);
    setGuidanceTip('Processing contrast, deskewing & OCR edge detection...');
    setTimeout(() => {
      setCapturing(false);
      setCaptured(true);
      setGuidanceTip('Document scan captured with optimal contrast!');
    }, 700);
  };

  const handleConfirm = () => {
    // Generate simulated data URL for scan
    const simulatedDataUrl = 'data:application/pdf;base64,JVBERi0xLjQKJVRheEd1YXJkIFNjYW5uZWQgRG9jdW1lbnQ=';
    onCapture(simulatedDataUrl);
    setCaptured(false);
    onClose();
  };

  const handleRetake = () => {
    setCaptured(false);
    setGuidanceTip('Align document borders within the frame');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scanner-modal-title"
    >
      <div className="bg-[#061A2F] text-white rounded-lg border border-[#C99A32] max-w-lg w-full p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#E8C66A]" />
            <h3 id="scanner-modal-title" className="text-sm font-bold text-white tracking-wide">
              Document Camera Scanner
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
            aria-label="Close camera scanner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewfinder simulation */}
        <div className="relative aspect-4/3 bg-black rounded-lg border-2 border-dashed border-[#C99A32]/60 overflow-hidden flex flex-col items-center justify-center p-4">
          {/* Target guidelines */}
          <div className="absolute inset-4 border border-white/20 rounded pointer-events-none flex flex-col justify-between p-2">
            <div className="flex justify-between text-[10px] font-mono text-[#E8C66A]/80">
              <span>[A/R TAX DESKEW]</span>
              <span>200 DPI TARGET</span>
            </div>
            <div className="flex justify-between text-[10px] font-mono text-[#E8C66A]/80">
              <span>AUTO-LEVEL: ON</span>
              <span>AES-256 VAULT</span>
            </div>
          </div>

          {!captured ? (
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-white/5 border border-[#C99A32] flex items-center justify-center mx-auto text-[#E8C66A]">
                <Camera className="w-8 h-8 animate-pulse" />
              </div>
              <p className="text-xs text-gray-300 max-w-xs">
                {guidanceTip}
              </p>
            </div>
          ) : (
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-[#1B5E20]/30 border border-[#4CAF50] flex items-center justify-center mx-auto text-[#4CAF50]">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div className="text-xs font-bold text-white">
                Scan Captured & Flattened
              </div>
              <p className="text-[11px] text-[#A0AEC0]">
                Resolution: 2400 x 3100 • Sharpness: High • OCR Ready
              </p>
            </div>
          )}
        </div>

        {/* Security / disclaimer */}
        <div className="flex items-center gap-2 text-[11px] text-gray-400 bg-white/5 p-2 rounded border border-white/10">
          <ShieldCheck className="w-4 h-4 text-[#E8C66A] flex-shrink-0" />
          <span>Local edge scanning: documents are encrypted prior to vault transmission.</span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {!captured ? (
              <button
                type="button"
                onClick={handleSimulateCapture}
                disabled={capturing}
                className="px-4 py-2 bg-[#C99A32] hover:bg-[#D7AC4A] text-[#061A2F] text-xs font-bold rounded flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                {capturing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Capturing...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5" />
                    <span>Capture Scan</span>
                  </>
                )}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retake</span>
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="px-4 py-2 bg-[#E8C66A] hover:bg-[#D7AC4A] text-[#061A2F] text-xs font-bold rounded transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Save to Vault</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
