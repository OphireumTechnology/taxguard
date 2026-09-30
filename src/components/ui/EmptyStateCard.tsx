import React from 'react';
import { Calendar, RefreshCw } from 'lucide-react';
import { BrandedButton } from './BrandedButton';

export interface EmptyStateCardProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  variant?: 'light' | 'dark';
  className?: string;
}

export const EmptyStateCard: React.FC<EmptyStateCardProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  primaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  variant = 'light',
  className = '',
}) => {
  const isLight = variant === 'light';
  const effectiveActionLabel = primaryAction ? primaryAction.label : actionLabel;
  const effectiveOnAction = primaryAction ? primaryAction.onClick : onAction;

  return (
    <div
      className={`py-12 px-6 text-center rounded-2xl border flex flex-col items-center justify-center space-y-3 ${
        isLight
          ? 'bg-[#FBF8F1] border-[#D8C9A5] text-[#10233D]'
          : 'bg-[#081E36] border-[#244567] text-[#F7F1E5]'
      } ${className}`}
    >
      <div
        className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-1 border ${
          isLight
            ? 'bg-[#F4E7C3] border-[#B98B32] text-[#10233D]'
            : 'bg-[#0D2746] border-[#C99A3D] text-[#E2B957]'
        }`}
      >
        {icon || <Calendar className="w-7 h-7" />}
      </div>

      <h3
        className={`font-serif text-base sm:text-lg font-bold ${
          isLight ? 'text-[#10233D]' : 'text-[#F7F1E5]'
        }`}
      >
        {title}
      </h3>

      <p
        className={`text-xs sm:text-sm max-w-md leading-relaxed ${
          isLight ? 'text-[#52657B]' : 'text-slate-300'
        }`}
      >
        {description}
      </p>

      {(effectiveActionLabel || secondaryActionLabel) && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {effectiveActionLabel && effectiveOnAction && (
            <BrandedButton
              size="sm"
              variant="primary"
              onClick={effectiveOnAction}
            >
              {effectiveActionLabel}
            </BrandedButton>
          )}

          {secondaryActionLabel && onSecondaryAction && (
            <BrandedButton
              size="sm"
              variant={isLight ? 'outline' : 'secondary'}
              onClick={onSecondaryAction}
            >
              {secondaryActionLabel}
            </BrandedButton>
          )}
        </div>
      )}
    </div>
  );
};
