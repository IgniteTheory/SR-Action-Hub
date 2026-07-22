import type { ActionStatus, CommunicationSource, Priority, Turnaround } from '../api/types';

export function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export const STATUS_LABELS: Record<ActionStatus, string> = {
  NEW: 'New',
  ALLOCATED: 'Allocated',
  IN_PROGRESS: 'In Progress',
  WAITING_CLIENT: 'Waiting for Client',
  WAITING_SARS: 'Waiting for SARS',
  WAITING_BANK: 'Waiting for Bank',
  WAITING_THIRD_PARTY: 'Waiting for Third Party',
  SNOOZED: 'Snoozed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  NORMAL: 'Normal',
  LOW: 'Low',
};

export const TURNAROUND_LABELS: Record<Turnaround, string> = {
  URGENT: 'Urgent',
  HOURS_2_3: '2–3 Hours',
  TODAY: 'Today',
  DAY_1: '1 Day',
  DAYS_2_3: '2–3 Days',
  WEEK_1: '1 Week',
  CUSTOM: 'Custom',
};

export const COMM_SOURCE_LABELS: Record<CommunicationSource, string> = {
  PHONE: 'Phone',
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
  WALK_IN: 'Walk-in',
  TEAMS: 'Microsoft Teams',
  INTERNAL: 'Internal',
  OTHER: 'Other',
};
