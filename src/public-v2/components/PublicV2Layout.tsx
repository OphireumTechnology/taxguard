import React, { useState } from 'react';
import { PublicV2Header } from './PublicV2Header';
import { PublicV2Footer } from './PublicV2Footer';
import { PublicV2ConsultationModal } from './PublicV2ConsultationModal';

interface PublicV2LayoutProps {
  children: React.ReactNode;
  activePath: string;
  onNavigate: (path: string) => void;
}

export const PublicV2Layout: React.FC<PublicV2LayoutProps> = ({
  children,
  activePath,
  onNavigate
}) => {
  const [isConsultationOpen, setIsConsultationOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-black font-sans antialiased selection:bg-black selection:text-white flex flex-col justify-between">
      <PublicV2Header
        activePath={activePath}
        onNavigate={onNavigate}
        onOpenConsultation={() => setIsConsultationOpen(true)}
      />

      <main className="flex-1 w-full bg-white">
        {children}
      </main>

      <PublicV2Footer
        onNavigate={onNavigate}
        onOpenConsultation={() => setIsConsultationOpen(true)}
      />

      <PublicV2ConsultationModal
        isOpen={isConsultationOpen}
        onClose={() => setIsConsultationOpen(false)}
      />
    </div>
  );
};
