export class LiveWorkflowGateService {
  static evaluateGate(_stage: number, _context: any): { allowed: boolean; reason?: string } {
    return { allowed: true };
  }
}
