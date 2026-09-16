import { addMonths, differenceInCalendarDays, format, isBefore, parseISO, startOfDay } from 'date-fns';

/**
 * Próxima data de reajuste a partir do início da vigência, repetindo a cada `periodMonths`
 * meses, retornando a primeira ocorrência que não é anterior a `referenceDate`.
 */
export function computeNextReadjustmentDate(
  startDateIso: string,
  periodMonths: number,
  referenceDate: Date,
): string {
  const reference = startOfDay(referenceDate);
  let candidate = startOfDay(parseISO(startDateIso));
  while (isBefore(candidate, reference)) {
    candidate = addMonths(candidate, periodMonths);
  }
  return format(candidate, 'yyyy-MM-dd');
}

/** `true` quando `targetDateIso` cai dentro dos próximos `noticeDays` dias a partir de hoje. */
export function isWithinNoticeWindow(targetDateIso: string, noticeDays: number, referenceDate: Date): boolean {
  const diff = differenceInCalendarDays(startOfDay(parseISO(targetDateIso)), startOfDay(referenceDate));
  return diff >= 0 && diff <= noticeDays;
}
