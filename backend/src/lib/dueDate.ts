import { Turnaround } from '@prisma/client';

// Simple calendar-time offsets from creation. Does not account for business
// hours/weekends/holidays yet — a reasonable Phase 1 simplification.
export function calculateDueDate(
  turnaround: Turnaround,
  customHours: number | null,
  from: Date = new Date(),
  customDate: Date | null = null
): Date {
  const due = new Date(from);
  switch (turnaround) {
    case 'CUSTOM_DATE':
      return customDate ?? due;
    case 'URGENT':
      due.setHours(due.getHours() + 1);
      return due;
    case 'HOURS_2_3':
      due.setHours(due.getHours() + 3);
      return due;
    case 'TODAY':
      due.setHours(17, 0, 0, 0);
      if (due < from) due.setDate(due.getDate() + 1);
      return due;
    case 'DAY_1':
      due.setDate(due.getDate() + 1);
      return due;
    case 'DAYS_2_3':
      due.setDate(due.getDate() + 3);
      return due;
    case 'WEEK_1':
      due.setDate(due.getDate() + 7);
      return due;
    case 'CUSTOM':
      due.setHours(due.getHours() + (customHours ?? 24));
      return due;
    default:
      due.setDate(due.getDate() + 1);
      return due;
  }
}
