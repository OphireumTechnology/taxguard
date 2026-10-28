export interface StaffMemberRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  mfaEnabled?: boolean;
}

export interface StaffInvitationRecord {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  expiresAt: string;
}

export interface StaffDirectoryPage<T = StaffMemberRecord> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}
