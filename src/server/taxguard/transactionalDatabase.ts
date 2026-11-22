import type { TransactionalDatabase } from './authority.repository';

const collections = new Map<string, Map<string, any>>();

function getCollectionMap(name: string): Map<string, any> {
  let col = collections.get(name);
  if (!col) {
    col = new Map<string, any>();
    collections.set(name, col);
  }
  return col;
}

function makeDocRef(collectionPath: string, docId: string) {
  const col = getCollectionMap(collectionPath);
  return {
    id: docId,
    path: `${collectionPath}/${docId}`,
    _col: col,
    async get() {
      const exists = col.has(docId);
      const val = col.get(docId);
      return {
        id: docId,
        exists,
        data: () => (val !== undefined ? structuredClone(val) : undefined),
      };
    },
    async create(data: any) {
      col.set(docId, structuredClone(data));
    },
    async set(data: any, options?: { merge?: boolean }) {
      if (options?.merge && col.has(docId)) {
        col.set(docId, { ...col.get(docId), ...structuredClone(data) });
      } else {
        col.set(docId, structuredClone(data));
      }
    },
    async update(data: any) {
      const existing = col.get(docId) ?? {};
      col.set(docId, { ...existing, ...structuredClone(data) });
    },
    async delete() {
      col.delete(docId);
    },
    collection(subCollection: string) {
      return makeCollectionRef(`${collectionPath}/${docId}/${subCollection}`);
    },
  };
}

function makeQuery(collectionPath: string, filters: Array<{ field: string; op: string; value: any }> = [], maxLimit?: number) {
  const col = getCollectionMap(collectionPath);
  const queryObj: any = {
    where(field: string, op: string, value: any) {
      return makeQuery(collectionPath, [...filters, { field, op, value }], maxLimit);
    },
    orderBy(_field: string, _dir?: string) {
      return queryObj;
    },
    limit(n: number) {
      return makeQuery(collectionPath, filters, n);
    },
    async get() {
      let entries = Array.from(col.entries()).filter(([, doc]) =>
        filters.every(({ field, op, value }) => {
          const actual = doc?.[field];
          if (op === '==') return actual === value;
          if (op === '!=') return actual !== value;
          if (op === 'in' && Array.isArray(value)) return value.includes(actual);
          if (op === 'array-contains' && Array.isArray(actual)) return actual.includes(value);
          return true;
        })
      );
      if (typeof maxLimit === 'number') {
        entries = entries.slice(0, maxLimit);
      }
      const docs = entries.map(([id, val]) => ({
        id,
        exists: true,
        ref: makeDocRef(collectionPath, id),
        data: () => structuredClone(val),
      }));
      return {
        empty: docs.length === 0,
        size: docs.length,
        docs,
        forEach: (cb: (doc: any) => void) => docs.forEach(cb),
      };
    },
  };
  return queryObj;
}

function makeCollectionRef(collectionPath: string) {
  return {
    path: collectionPath,
    doc(docId?: string) {
      const id = docId || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      return makeDocRef(collectionPath, id);
    },
    where(field: string, op: string, value: any) {
      return makeQuery(collectionPath, [{ field, op, value }]);
    },
    orderBy(field: string, dir?: string) {
      return makeQuery(collectionPath).orderBy(field, dir);
    },
    limit(n: number) {
      return makeQuery(collectionPath, [], n);
    },
    async get() {
      return makeQuery(collectionPath).get();
    },
    async add(data: any) {
      const ref = makeDocRef(collectionPath, `doc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
      await ref.set(data);
      return ref;
    },
  };
}

export const globalAuthorityDatabase: TransactionalDatabase & { persistenceCapability: 'in_memory' | 'durable' } = {
  persistenceCapability: 'in_memory',
  collection(name: string) {
    return makeCollectionRef(name);
  },
  doc(path: string) {
    const parts = path.split('/').filter(Boolean);
    const id = parts.pop() || 'root';
    const colPath = parts.join('/') || 'root';
    return makeDocRef(colPath, id);
  },
  async runTransaction<T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> {
    const transaction = {
      async get(refOrQuery: any) {
        return refOrQuery.get();
      },
      create(ref: any, data: any) {
        ref._col.set(ref.id, structuredClone(data));
      },
      set(ref: any, data: any, options?: { merge?: boolean }) {
        if (options?.merge && ref._col.has(ref.id)) {
          ref._col.set(ref.id, { ...ref._col.get(ref.id), ...structuredClone(data) });
        } else {
          ref._col.set(ref.id, structuredClone(data));
        }
      },
      update(ref: any, data: any) {
        const existing = ref._col.get(ref.id) ?? {};
        ref._col.set(ref.id, { ...existing, ...structuredClone(data) });
      },
      delete(ref: any) {
        ref._col.delete(ref.id);
      },
    };
    return updateFunction(transaction);
  },
};
