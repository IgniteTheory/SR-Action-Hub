export type Role = 'ADMINISTRATOR' | 'STAFF';

export type CommunicationSource = 'PHONE' | 'EMAIL' | 'WHATSAPP' | 'WALK_IN' | 'TEAMS' | 'INTERNAL' | 'OTHER';

export type Priority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

export type Turnaround = 'URGENT' | 'HOURS_2_3' | 'TODAY' | 'DAY_1' | 'DAYS_2_3' | 'WEEK_1' | 'CUSTOM' | 'CUSTOM_DATE';

export type ActionStatus =
  | 'NEW'
  | 'ALLOCATED'
  | 'IN_PROGRESS'
  | 'WAITING_CLIENT'
  | 'WAITING_SARS'
  | 'WAITING_BANK'
  | 'WAITING_THIRD_PARTY'
  | 'SNOOZED'
  | 'COMPLETED'
  | 'CANCELLED';

export type QuoteBehavior = 'NEVER' | 'MANUAL' | 'AUTO';

export type QuoteStatus = 'NOT_NEEDED' | 'NEEDS_MANUAL_QUOTE' | 'NEEDS_INTERNAL_APPROVAL' | 'PENDING_APPROVAL' | 'ACCEPTED' | 'DECLINED';

export interface UserSummary {
  id: number;
  name: string;
  email: string;
  role: Role;
  colour: string;
  requiresTimesheetCheck: boolean;
}

export interface Client {
  id: number;
  name: string;
  notes: string | null;
  contacts?: Contact[];
  actions?: Action[];
}

export interface Contact {
  id: number;
  clientId: number;
  name: string;
  phone: string | null;
  email: string | null;
}

export interface RequestType {
  id: number;
  name: string;
  isActive: boolean;
  quoteBehavior: QuoteBehavior;
  price: string | null;
}

export interface StatusHistoryEntry {
  id: number;
  actionId: number;
  fromStatus: ActionStatus | null;
  toStatus: ActionStatus;
  changedBy: UserSummary;
  changedAt: string;
  note: string | null;
}

export interface Action {
  id: number;
  ticketNumber: string;
  clientId: number;
  client: Client;
  contactId: number | null;
  contact: Contact | null;
  contactPerson: string;
  telephone: string | null;
  email: string | null;
  communicationSource: CommunicationSource;
  requestTypeId: number;
  requestType: RequestType;
  otherRequestDetail: string | null;
  description: string;
  assignedToId: number | null;
  assignedTo: UserSummary | null;
  priority: Priority;
  turnaround: Turnaround;
  customTurnaroundHours: number | null;
  dueAt: string;
  status: ActionStatus;
  snoozeUntil: string | null;
  snoozeReason: string | null;
  sendAcknowledgement: boolean;
  acknowledgementEmailSentAt: string | null;
  acknowledgementEmailError: string | null;
  quoteStatus: QuoteStatus;
  quoteAmount: string | null;
  quoteToken: string | null;
  quoteRespondedAt: string | null;
  quoteEmailSentAt: string | null;
  quoteEmailError: string | null;
  quoteBilled: boolean;
  addedToTimesheet: boolean;
  completionEmailSentAt: string | null;
  completionEmailError: string | null;
  createdById: number;
  createdBy: UserSummary;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  deletedAt: string | null;
  statusHistory?: StatusHistoryEntry[];
}

export interface DashboardKpis {
  overdue: number;
  dueToday: number;
  waiting: number;
  completedToday: number;
  newActions: number;
  approvalPending: number;
  avgTurnaroundHours: number | null;
}
