import {
  Inbox,
  Search,
  UserCheck,
  Hammer,
  CheckCircle2,
  Archive,
} from 'lucide-react'

/** The report lifecycle as an ordered "civic line" (transit stations). */
export const STATUS_ORDER = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
]

export const STATUS_META = {
  SUBMITTED: {
    label: 'ثبت شده',
    icon: Inbox,
    hex: '#0ea5e9',
    dot: 'bg-sky-500',
    chip: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  },
  UNDER_REVIEW: {
    label: 'در حال بررسی',
    icon: Search,
    hex: '#38bdf8',
    dot: 'bg-sky-400',
    chip: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  },
  ASSIGNED: {
    label: 'ارجاع داده‌شده',
    icon: UserCheck,
    hex: '#f9b526',
    dot: 'bg-beacon-400',
    chip: 'bg-beacon-100 text-beacon-800 dark:bg-beacon-400/15 dark:text-beacon-300',
  },
  IN_PROGRESS: {
    label: 'در حال اقدام',
    icon: Hammer,
    hex: '#f2a20d',
    dot: 'bg-beacon-500',
    chip: 'bg-beacon-100 text-beacon-800 dark:bg-beacon-400/15 dark:text-beacon-300',
  },
  RESOLVED: {
    label: 'حل‌شده',
    icon: CheckCircle2,
    hex: '#10b981',
    dot: 'bg-civic-500',
    chip: 'bg-civic-100 text-civic-700 dark:bg-civic-500/15 dark:text-civic-300',
  },
  CLOSED: {
    label: 'مختومه',
    icon: Archive,
    hex: '#64748b',
    dot: 'bg-slate-400',
    chip: 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300',
  },
}

export function statusMeta(status) {
  return STATUS_META[status] || STATUS_META.SUBMITTED
}

/** Index of a status on the lifecycle line (−1 if unknown). */
export function statusIndex(status) {
  return STATUS_ORDER.indexOf(status)
}
