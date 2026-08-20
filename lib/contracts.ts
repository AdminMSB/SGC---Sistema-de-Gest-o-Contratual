import { addMonths, format, isAfter, parseISO, startOfDay } from 'date-fns';
import type { PaymentFrequency, PaymentStatus } from '@/types/domain';

const INTERVAL_MONTHS: Partial<Record<PaymentFrequency, number>> = {
  mensal: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

// Trava de segurança contra vigências absurdamente longas (não deve ocorrer com uso normal).
const MAX_SCHEDULED_PAYMENTS = 600;

export interface ScheduledPayment {
  dueDate: string;
  amountCents: number;
}

export interface GenerateScheduleInput {
  startDate: string;
  endDate: string | null;
  frequency: PaymentFrequency;
  amountCents: number;
}

/**
 * Gera as parcelas de um contrato a partir da vigência e da frequência de pagamento.
 * `unico` gera uma parcela na data de início. `outro` e contratos sem `endDate` (prazo
 * indeterminado) não geram cronograma automático — as parcelas são lançadas manualmente.
 */
export function generatePaymentSchedule(input: GenerateScheduleInput): ScheduledPayment[] {
  const { startDate, endDate, frequency, amountCents } = input;

  if (frequency === 'unico') {
    return [{ dueDate: startDate, amountCents }];
  }

  const intervalMonths = INTERVAL_MONTHS[frequency];
  if (!intervalMonths || !endDate) {
    return [];
  }

  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (isAfter(start, end)) return [];

  const payments: ScheduledPayment[] = [];
  let cursor = start;
  while (!isAfter(cursor, end) && payments.length < MAX_SCHEDULED_PAYMENTS) {
    payments.push({ dueDate: format(cursor, 'yyyy-MM-dd'), amountCents });
    cursor = addMonths(cursor, intervalMonths);
  }
  return payments;
}

/**
 * Uma parcela pendente cujo vencimento já passou é tratada como "atrasado" na exibição,
 * sem precisar de um job para atualizar o status gravado no banco.
 */
export function paymentEffectiveStatus(
  payment: { status: PaymentStatus; dueDate: string },
  referenceDate: Date = new Date(),
): PaymentStatus {
  if (payment.status !== 'pendente') return payment.status;
  const dueDate = parseISO(payment.dueDate);
  return isAfter(startOfDay(referenceDate), dueDate) ? 'atrasado' : 'pendente';
}
