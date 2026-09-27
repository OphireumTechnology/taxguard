import {
  useCallback,
  useEffect,
  useState
} from 'react';

import {
  LiveWorkflowAuthority,
  LiveWorkflowAuthoritySnapshot
} from '../services/liveWorkflowAuthority';

export function useLiveWorkflowAuthority(
  taxYear: number | null
) {

  const [
    state,
    setState
  ] = useState<LiveWorkflowAuthoritySnapshot>(
    LiveWorkflowAuthority.getSnapshot()
  );

  useEffect(() => {

    return LiveWorkflowAuthority.subscribe(
      setState
    );

  }, []);

  useEffect(() => {

    if (!taxYear) {
      return;
    }

    LiveWorkflowAuthority
      .hydrate(taxYear)
      .catch(() => {
        /*
         * Error is stored by authority service.
         *
         * Fail closed:
         * no stage becomes eligible.
         */
      });

  }, [taxYear]);

  const refresh =
    useCallback(async () => {

      if (!taxYear) {
        return null;
      }

      return LiveWorkflowAuthority
        .hydrate(taxYear);

    }, [taxYear]);

  return {
    ...state,

    refresh,

    canEnterStage:
      (stage: 1 | 2 | 3) =>
        LiveWorkflowAuthority
          .canEnterStage(stage),

    activeStage:
      LiveWorkflowAuthority
        .getActiveStage()
  };
}
