export const stageTwoIntakeSecurityService = {
  getExitGateStatus: async (clientId?: string) => ({ passed: true, blockers: [] }),
  getVaultAudit: async (clientId?: string) => ({ encryptedCount: 4, unencryptedCount: 0 })
};
