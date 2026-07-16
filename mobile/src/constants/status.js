import { colors } from '../theme';

/** Report lifecycle — mirrors backend reports/serializers ALLOWED_STATUS_TRANSITIONS. */
export const STATUS_ORDER = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
];

export const STATUS_LABEL = {
  SUBMITTED: 'ثبت شده',
  UNDER_REVIEW: 'در حال بررسی',
  ASSIGNED: 'ارجاع داده‌شده',
  IN_PROGRESS: 'در حال اقدام',
  RESOLVED: 'حل‌شده',
  CLOSED: 'مختومه',
};

export const STATUS_COLOR = {
  SUBMITTED: colors.sky[500],
  UNDER_REVIEW: colors.sky[400],
  ASSIGNED: colors.brand[400], // beacon
  IN_PROGRESS: colors.brand[500], // beacon
  RESOLVED: colors.civic[500], // emerald
  CLOSED: colors.slate,
};

export const statusIndex = (s) => Math.max(0, STATUS_ORDER.indexOf(s));
