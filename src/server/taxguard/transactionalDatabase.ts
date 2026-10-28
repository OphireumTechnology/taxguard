import { TransactionalDatabase } from './authority.repository';

class InMemoryTransactionalDatabase implements TransactionalDatabase {
  persistenceCapability = 'in-memory';

  async runTransaction<T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> {
    const tx = {
      get: async () => ({ exists: false, data: () => null }),
      set: async () => {},
      update: async () => {},
      delete: async () => {}
    };
    return await updateFunction(tx);
  }

  collection(_name: string) {
    return {
      doc: (_id: string) => ({
        get: async () => ({ exists: false, data: () => null }),
        set: async () => {},
        update: async () => {},
        delete: async () => {}
      }),
      where: () => ({
        get: async () => ({ docs: [] })
      })
    };
  }

  doc(_path: string) {
    return {
      get: async () => ({ exists: false, data: () => null }),
      set: async () => {},
      update: async () => {},
      delete: async () => {}
    };
  }
}

export const globalAuthorityDatabase: TransactionalDatabase = new InMemoryTransactionalDatabase();
