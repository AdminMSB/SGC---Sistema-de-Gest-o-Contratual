import { differenceInCalendarDays, differenceInCalendarMonths, parseISO, startOfDay } from 'date-fns';
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

export interface VigenciaCountdown {
  label: string;
  tone: 'destructive' | 'warning' | 'neutral';
}

/**
 * Contagem regressiva até o fim da vigência: em dias quando falta menos de um mês (destacando
 * vencido/prestes a vencer), em meses caso contrário.
 */
export function computeVigenciaCountdown(
  endDate: string | null,
  referenceDate: Date = new Date(),
): VigenciaCountdown | null {
  if (!endDate) return null;

  const end = startOfDay(parseISO(endDate));
  const today = startOfDay(referenceDate);
  const diffDays = differenceInCalendarDays(end, today);

  if (diffDays < 0) {
    return { label: `Vencido há ${pluralize(Math.abs(diffDays), 'dia', 'dias')}`, tone: 'destructive' };
  }
  if (diffDays === 0) {
    return { label: 'Vence hoje', tone: 'warning' };
  }
  if (diffDays < 30) {
    return { label: `${remaining(diffDays)} ${pluralize(diffDays, 'dia', 'dias')}`, tone: 'warning' };
  }
  const months = Math.max(differenceInCalendarMonths(end, today), 1);
  return { label: `${remaining(months)} ${pluralize(months, 'mês', 'meses')}`, tone: 'neutral' };
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function remaining(count: number): string {
  return count === 1 ? 'Falta' : 'Faltam';
}
