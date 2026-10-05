/**
 * A/R Tax Services, LLC — Stage 09: Prepare Taxes Workspace
 * Official Form 1040 & State Tax Preparation Gateway
 *
 * Adheres strictly to the ZERO-DATA RULE: fetches authoritative calculation data
 * from the server with truthful empty states when no calculation has been completed.
 */

import React from 'react';
import { StageNinePrepareTaxesView } from './StageNinePrepareTaxesView';

export interface StageNinePrepareViewProps {
  clientId: string;
  selectedTaxYear: number;
  onNavigateToStageTen?: () => void;
  onNavigateToStageEight?: () => void;
}

export const StageNinePrepareView: React.FC<StageNinePrepareViewProps> = ({
  clientId,
  selectedTaxYear,
  onNavigateToStageTen,
  onNavigateToStageEight
}) => {
  return (
    <StageNinePrepareTaxesView
      clientId={clientId}
      selectedTaxYear={selectedTaxYear}
      onNavigateToStageTen={onNavigateToStageTen}
      onNavigateToStageEight={onNavigateToStageEight}
    />
  );
};
