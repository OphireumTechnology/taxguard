export function requestMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Document request operation failed.';
}

export function requestStatusText(status: string): string {
  switch (status) {
    case 'FULFILLED': return 'Fulfilled';
    case 'WAIVED': return 'Waived by Preparer';
    case 'CANCELLED': return 'Cancelled';
    default: return 'Pending Upload';
  }
}

export interface ChecklistTemplate {
  templateId: string;
  name: string;
  lines: Array<{ title: string; category: string; required: boolean }>;
}

export interface DocumentRequestItem {
  requestId: string;
  clientId: string;
  title: string;
  category: string;
  status: string;
  required: boolean;
  dueDate?: string;
  instructions?: string;
  fulfilledDocumentId?: string;
}

export const documentRequestService = {
  missing: async (params?: any) => ({ items: [], overdueCount: 0 }),
  list: async (clientId: string): Promise<DocumentRequestItem[]> => [],
  targets: async (clientId: string) => [],
  templates: async (): Promise<ChecklistTemplate[]> => [
    { templateId: 'tpl_1040', name: 'Standard 1040 Checklist', lines: [{ title: 'W-2', category: 'tax_form_w2', required: true }] }
  ],
  create: async (data: any) => ({ success: true }),
  applyTemplate: async (data: any) => ({ success: true }),
  saveTemplate: async (data: any) => ({ success: true }),
  waive: async (id: string, reason: string) => ({ success: true }),
  cancel: async (id: string, reason: string) => ({ success: true }),
  getRequests: async (clientId?: string): Promise<DocumentRequestItem[]> => [],
  createRequest: async (req: Partial<DocumentRequestItem>): Promise<{ success: boolean }> => ({ success: true }),
  fulfillRequest: async (id: string, docId: string): Promise<{ success: boolean }> => ({ success: true })
};
