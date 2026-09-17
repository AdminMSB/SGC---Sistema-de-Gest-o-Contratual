import { describe, expect, it } from 'vitest';
import { isWithinNoticeWindow } from '@/lib/contract-alerts';

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
