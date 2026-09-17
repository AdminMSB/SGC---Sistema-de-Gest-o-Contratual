import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';

/** `true` quando `targetDateIso` cai dentro dos próximos `noticeDays` dias a partir de hoje. */
export function isWithinNoticeWindow(targetDateIso: string, noticeDays: number, referenceDate: Date): boolean {
  const diff = differenceInCalendarDays(startOfDay(parseISO(targetDateIso)), startOfDay(referenceDate));
  return diff >= 0 && diff <= noticeDays;
}
