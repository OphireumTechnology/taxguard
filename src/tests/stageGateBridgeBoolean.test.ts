import { expect, it, vi } from 'vitest';
import { persistPassedStageGate, type StageGateBridgeInput } from '../server/taxguard/stageGateBridge';
import { LiveWorkflowGateService } from '../server/taxguard/liveWorkflowGate.service';
it.each([undefined, null, false, 1, 'true', {}, []])('rejects nonboolean gate success %j before commit', async gatePassed => {
  const commit = vi.spyOn(LiveWorkflowGateService, 'commitPassedGate');
  try {
    await expect(persistPassedStageGate({ gatePassed, gateName: 'SYNTHETIC' } as unknown as StageGateBridgeInput)).rejects.toThrow('Workflow transition denied');
    expect(commit).not.toHaveBeenCalled();
  } finally { commit.mockRestore(); }
});
