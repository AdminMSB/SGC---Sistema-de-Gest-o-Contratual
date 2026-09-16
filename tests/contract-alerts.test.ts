import { describe, expect, it } from 'vitest';
import { computeNextReadjustmentDate, isWithinNoticeWindow } from '@/lib/contract-alerts';

describe('computeNextReadjustmentDate', () => {
  it('retorna a própria data de início quando ela ainda não passou', () => {
    const result = computeNextReadjustmentDate('2026-06-01', 12, new Date('2026-01-01T12:00:00Z'));
    expect(result).toBe('2026-06-01');
  });

  it('avança um período quando a data de início já passou', () => {
    const result = computeNextReadjustmentDate('2025-06-01', 12, new Date('2026-01-01T12:00:00Z'));
    expect(result).toBe('2026-06-01');
  });

  it('avança múltiplos períodos até achar uma data futura', () => {
    const result = computeNextReadjustmentDate('2023-01-01', 6, new Date('2026-02-01T12:00:00Z'));
    // 2023-01, 07; 2024-01, 07; 2025-01, 07; 2026-01 -> próxima é 2026-07-01
    expect(result).toBe('2026-07-01');
  });

  it('considera o próprio dia de referência como válido (não avança)', () => {
    const result = computeNextReadjustmentDate('2026-01-01', 12, new Date('2026-01-01T12:00:00Z'));
    expect(result).toBe('2026-01-01');
  });
});

describe('isWithinNoticeWindow', () => {
  const reference = new Date('2026-01-01T12:00:00Z');

  it('está dentro da janela quando a data cai exatamente no limite de dias', () => {
    expect(isWithinNoticeWindow('2026-01-31', 30, reference)).toBe(true);
  });

  it('não está dentro da janela quando a data é além do limite', () => {
    expect(isWithinNoticeWindow('2026-02-01', 30, reference)).toBe(false);
  });

  it('está dentro da janela quando a data é hoje', () => {
    expect(isWithinNoticeWindow('2026-01-01', 30, reference)).toBe(true);
  });

  it('não está dentro da janela quando a data já passou', () => {
    expect(isWithinNoticeWindow('2025-12-31', 30, reference)).toBe(false);
  });
});
