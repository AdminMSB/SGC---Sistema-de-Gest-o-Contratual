import { describe, expect, it } from 'vitest';
import { generatePaymentSchedule, paymentEffectiveStatus } from '@/lib/contracts';

describe('generatePaymentSchedule', () => {
  it('gera uma parcela única para frequência "unico", ignorando endDate', () => {
    const schedule = generatePaymentSchedule({
      startDate: '2026-01-10',
      endDate: '2026-12-10',
      frequency: 'unico',
      amountCents: 500000,
    });
    expect(schedule).toEqual([{ dueDate: '2026-01-10', amountCents: 500000 }]);
  });

  it('gera 12 parcelas mensais ao longo de um ano', () => {
    const schedule = generatePaymentSchedule({
      startDate: '2026-01-10',
      endDate: '2026-12-10',
      frequency: 'mensal',
      amountCents: 100000,
    });
    expect(schedule).toHaveLength(12);
    expect(schedule[0]).toEqual({ dueDate: '2026-01-10', amountCents: 100000 });
    expect(schedule[11]).toEqual({ dueDate: '2026-12-10', amountCents: 100000 });
  });

  it('gera 4 parcelas trimestrais ao longo de um ano', () => {
    const schedule = generatePaymentSchedule({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      frequency: 'trimestral',
      amountCents: 300000,
    });
    expect(schedule.map((p) => p.dueDate)).toEqual([
      '2026-01-01',
      '2026-04-01',
      '2026-07-01',
      '2026-10-01',
    ]);
  });

  it('gera 2 parcelas semestrais ao longo de um ano', () => {
    const schedule = generatePaymentSchedule({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      frequency: 'semestral',
      amountCents: 600000,
    });
    expect(schedule.map((p) => p.dueDate)).toEqual(['2026-01-01', '2026-07-01']);
  });

  it('gera 3 parcelas anuais ao longo de uma vigência de 3 anos', () => {
    const schedule = generatePaymentSchedule({
      startDate: '2026-01-01',
      endDate: '2028-06-01',
      frequency: 'anual',
      amountCents: 1200000,
    });
    expect(schedule.map((p) => p.dueDate)).toEqual(['2026-01-01', '2027-01-01', '2028-01-01']);
  });

  it('não gera cronograma automático para frequência "outro"', () => {
    const schedule = generatePaymentSchedule({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      frequency: 'outro',
      amountCents: 100000,
    });
    expect(schedule).toEqual([]);
  });

  it('não gera cronograma automático sem data de término (prazo indeterminado)', () => {
    const schedule = generatePaymentSchedule({
      startDate: '2026-01-01',
      endDate: null,
      frequency: 'mensal',
      amountCents: 100000,
    });
    expect(schedule).toEqual([]);
  });

  it('retorna vazio quando a data de término é anterior à de início', () => {
    const schedule = generatePaymentSchedule({
      startDate: '2026-06-01',
      endDate: '2026-01-01',
      frequency: 'mensal',
      amountCents: 100000,
    });
    expect(schedule).toEqual([]);
  });
});

describe('paymentEffectiveStatus', () => {
  const referenceDate = new Date('2026-08-10T12:00:00Z');

  it('mantém "pago" mesmo com vencimento no passado', () => {
    expect(paymentEffectiveStatus({ status: 'pago', dueDate: '2026-01-01' }, referenceDate)).toBe('pago');
  });

  it('marca como "atrasado" uma parcela pendente com vencimento no passado', () => {
    expect(paymentEffectiveStatus({ status: 'pendente', dueDate: '2026-08-01' }, referenceDate)).toBe(
      'atrasado',
    );
  });

  it('mantém "pendente" uma parcela com vencimento futuro', () => {
    expect(paymentEffectiveStatus({ status: 'pendente', dueDate: '2026-09-01' }, referenceDate)).toBe(
      'pendente',
    );
  });

  it('mantém "pendente" no próprio dia do vencimento', () => {
    expect(paymentEffectiveStatus({ status: 'pendente', dueDate: '2026-08-10' }, referenceDate)).toBe(
      'pendente',
    );
  });
});
