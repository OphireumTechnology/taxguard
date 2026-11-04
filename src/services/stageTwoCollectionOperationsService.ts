export const stageTwoCollectionOperationsService = {
  getCollectionOperations: async (clientId?: string) => ({ status: 'IN_PROGRESS', progress: 85 }),
  submitExceptions: async (data: any) => ({ success: true })
};
