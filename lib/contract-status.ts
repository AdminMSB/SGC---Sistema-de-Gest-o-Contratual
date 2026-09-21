import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';
import type { ContractDisplayStatus, ContractStatus } from '@/types/domain';

/**
 * "Expirado" não é um status salvo — um contrato "ativo" cujo fim da vigência já passou é
 * exibido como expirado até alguém marcar manualmente como encerrado.
 */
export function computeDisplayStatus(
  status: ContractStatus,
  endDate: string | null,
  referenceDate: Date = new Date(),
): ContractDisplayStatus {
  if (status === 'ativo' && endDate) {
    const diff = differenceInCalendarDays(startOfDay(parseISO(endDate)), startOfDay(referenceDate));
    if (diff < 0) return 'expirado';
  }
  return status;
}
