export interface ClientServiceRequest {
  id: string;
  clientId: string;
  clientName: string;
  category: string;
  subject: string;
  status: 'open' | 'in_progress' | 'waiting_on_client' | 'resolved';
  priority: 'normal' | 'high' | 'urgent';
  createdAt: string;
  updatedAt: string;
}

export interface ClientServiceRequestDetail extends ClientServiceRequest {
  description: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  messages: Array<{
    id: string;
    senderName: string;
    senderRole: string;
    content: string;
    createdAt: string;
  }>;
}

export interface ClientServiceConversation {
  id: string;
  clientId: string;
  clientName: string;
  unreadCount: number;
  lastMessage: string;
  lastMessageTime: string;
}

export interface ClientServiceCase {
  id: string;
  clientId: string;
  clientName: string;
  taxYear: number;
  status: string;
  stageName: string;
}

export interface ClientServiceSnapshot {
  openInquiriesCount: number;
  unassignedRequestsCount: number;
  slaBreachedCount: number;
  activeRequests: ClientServiceRequest[];
  recentConversations: ClientServiceConversation[];
}
