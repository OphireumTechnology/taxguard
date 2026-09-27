import { 
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocFromServer,
  serverTimestamp,
  Unsubscribe
} from 'firebase/firestore';
import { db, auth } from './config';
import { 
  DocumentItem, 
  Appointment, 
  ServicePlan, 
  Invoice, 
  Message, 
  AuditLog,
  AccountingConnection,
  LegalCoordinationRecord
} from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Skill Constraint: Test server connection on boot
 */
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[Firestore] Live connection verified.');
    return true;
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorCode = error?.code;
    if (
      errorCode === 'unavailable' ||
      errorMsg.includes('unavailable') ||
      errorMsg.includes('the client is offline') ||
      errorMsg.includes('Could not reach Cloud Firestore backend') ||
      errorMsg.includes('Failed to get document')
    ) {
      console.warn('[Firestore] Operating in offline mode. Client will synchronize when connection is restored:', errorMsg);
      return false;
    }
    // Permission denied on test/connection is expected if default-deny is active; connection is working
    console.log('[Firestore] Host online and responding.');
    return true;
  }
}

// -----------------------------------------------------------------------------
// Services Catalog
// -----------------------------------------------------------------------------
export async function fetchServicesCatalog(): Promise<ServicePlan[]> {
  const path = 'services';
  try {
    const snap = await getDocs(collection(db, path));
    if (snap.empty) {
      return [];
    }
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ServicePlan));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

// -----------------------------------------------------------------------------
// Documents (Client & Accountant)
// -----------------------------------------------------------------------------
export function subscribeClientDocuments(
  clientId: string,
  onData: (docs: DocumentItem[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const path = 'documents';
  const q = query(collection(db, path), where('clientId', '==', clientId));

  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : (data.updatedAt || new Date().toISOString()),
      } as unknown as DocumentItem;
    });
    onData(items);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
    if (onError) onError(error);
  });
}

export function subscribeAccountantDocuments(
  accountantId: string,
  onData: (docs: DocumentItem[]) => void
): Unsubscribe {
  const path = 'documents';
  const q = query(collection(db, path), where('assignedAccountantId', '==', accountantId));

  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as unknown as DocumentItem));
    onData(items);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

// -----------------------------------------------------------------------------
// Appointments
// -----------------------------------------------------------------------------
export function subscribeUserAppointments(
  userId: string,
  role: string,
  onData: (apts: Appointment[]) => void
): Unsubscribe {
  const path = 'appointments';
  const field = role === 'accountant' ? 'accountantId' : 'clientId';
  const q = query(collection(db, path), where(field, '==', userId));

  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        scheduledTime: data.scheduledTime || data.dateTime || new Date().toISOString()
      } as unknown as Appointment;
    });
    onData(items);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

// -----------------------------------------------------------------------------
// Invoices
// -----------------------------------------------------------------------------
export function subscribeClientInvoices(
  clientId: string,
  onData: (invs: Invoice[]) => void
): Unsubscribe {
  const path = 'invoices';
  const q = query(collection(db, path), where('clientId', '==', clientId));

  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
    onData(items);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

// -----------------------------------------------------------------------------
// Messages
// -----------------------------------------------------------------------------
export function subscribeConversationMessages(
  conversationId: string,
  onData: (msgs: Message[]) => void
): Unsubscribe {
  const path = 'messages';
  const q = query(
    collection(db, path),
    where('conversationId', '==', conversationId),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message));
    onData(items);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

export async function sendMessage(
  conversationId: string,
  content: string,
  senderRole: 'client' | 'accountant' | 'administrator',
  senderName: string
): Promise<void> {
  const path = 'messages';
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  try {
    await setDoc(doc(db, path, msgId), {
      id: msgId,
      conversationId,
      senderId: auth.currentUser?.uid || '',
      senderRole,
      senderName,
      content,
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${path}/${msgId}`);
  }
}

// -----------------------------------------------------------------------------
// In-App Notifications
// -----------------------------------------------------------------------------
export function subscribeUserNotifications(
  userId: string,
  onData: (notifs: any[]) => void
): Unsubscribe {
  const path = 'notifications';
  const q = query(collection(db, path), where('userId', '==', userId));

  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    onData(items);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

export async function markNotificationRead(notifId: string): Promise<void> {
  const path = `notifications/${notifId}`;
  try {
    await updateDoc(doc(db, 'notifications', notifId), {
      read: true
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// -----------------------------------------------------------------------------
// Legal Consent Records
// -----------------------------------------------------------------------------
export async function recordLegalConsent(
  policyType: 'terms_of_service' | 'privacy_policy' | 'engagement_letter' | 'e_file_consent',
  version: string = '2026.1'
): Promise<void> {
  if (!auth.currentUser) return;
  const consentId = `cst_${auth.currentUser.uid}_${policyType}`;
  const path = `consentRecords/${consentId}`;
  try {
    await setDoc(doc(db, 'consentRecords', consentId), {
      id: consentId,
      userId: auth.currentUser.uid,
      policyType,
      version,
      accepted: true,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 200) : '',
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
