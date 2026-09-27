import { ref, uploadBytesResumable, getMetadata } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { storage, db, auth, functions } from './config';
import { DocumentItem } from '../types';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv'
];

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export interface UploadProgressCallback {
  (percent: number, bytesTransferred: number, totalBytes: number): void;
}

/**
 * Sanitize client file names to prevent directory traversal or injection attacks
 */
export function sanitizeFileName(rawName: string): string {
  const base = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.substring(0, 150);
}

/**
 * Upload client document with progress tracking, client isolation, and Firestore metadata creation.
 */
export async function uploadClientTaxDocument(
  file: File,
  category: string,
  taxYear: number = new Date().getFullYear(),
  organizationId?: string,
  onProgress?: UploadProgressCallback
): Promise<DocumentItem> {
  if (!auth.currentUser) {
    throw new Error('User must be authenticated to upload confidential tax records.');
  }

  // 1. File size validation
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File exceeds the maximum allowable size of 50MB (Provided: ${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
  }

  // 2. MIME type validation
  if (!ALLOWED_MIME_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.pdf') && !file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.csv')) {
    throw new Error(`Invalid file type (${file.type}). Allowed formats: PDF, PNG, JPEG, Excel, and CSV.`);
  }

  const clientId = auth.currentUser.uid;
  const documentId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const cleanName = sanitizeFileName(file.name);
  const storagePath = `clients/${clientId}/${documentId}/${cleanName}`;

  const storageRef = ref(storage, storagePath);

  // 3. Initiate resumable upload with metadata
  const metadata = {
    contentType: file.type || 'application/octet-stream',
    customMetadata: {
      uploadedBy: clientId,
      clientId,
      documentId,
      originalName: cleanName,
      taxYear: String(taxYear),
      scanStatus: 'pending_scan'
    }
  };

  const uploadTask = uploadBytesResumable(storageRef, file, metadata);

  await new Promise<void>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) {
          onProgress(percent, snapshot.bytesTransferred, snapshot.totalBytes);
        }
      },
      (error) => {
        reject(new Error(`Storage upload error: ${error.message}`));
      },
      () => {
        resolve();
      }
    );
  });

  // 4. Record document metadata in Firestore
  const docRecord: DocumentItem = {
    id: documentId,
    clientId,
    clientName: auth.currentUser.displayName || auth.currentUser.email || 'Client',
    fileName: cleanName,
    fileType: file.type || 'application/octet-stream',
    fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
    status: 'uploaded',
    uploadedAt: new Date().toISOString(),
    uploadedBy: auth.currentUser.displayName || auth.currentUser.email || 'Client',
    category: category as any,
    taxYear,
    version: 1,
    isEncrypted: true
  };

  await setDoc(doc(db, 'documents', documentId), {
    id: documentId,
    clientId,
    uploadedBy: clientId,
    fileName: cleanName,
    storagePath,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    category,
    status: 'uploaded',
    year: taxYear,
    organizationId: organizationId || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return docRecord;
}

/**
 * Obtain secure, short-lived (15 min) download URL via authorized Cloud Function.
 * Avoids long-lived public download tokens.
 */
export async function getSecureDownloadUrl(documentId: string): Promise<string> {
  try {
    const getDownloadFn = httpsCallable<{ documentId: string }, { success: boolean; downloadUrl: string }>(
      functions,
      'getSecureDocumentDownloadUrl'
    );
    const result = await getDownloadFn({ documentId });
    if (result.data?.downloadUrl) {
      return result.data.downloadUrl;
    }
    throw new Error('Download URL not returned.');
  } catch (err: any) {
    console.error('Secure download request failed:', err);
    throw new Error(err.message || 'Unable to generate secure download link.');
  }
}
