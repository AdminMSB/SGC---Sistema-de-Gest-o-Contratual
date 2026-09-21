import { describe, expect, it } from 'vitest';
import { computeDisplayStatus } from '@/lib/contract-status';

describe('computeDisplayStatus', () => {
  const reference = new Date('2026-01-10T12:00:00Z');

  it('mantém "ativo" quando a vigência ainda não acabou', () => {
    expect(computeDisplayStatus('ativo', '2026-01-31', reference)).toBe('ativo');
  });

  it('mantém "ativo" quando a vigência termina hoje', () => {
    expect(computeDisplayStatus('ativo', '2026-01-10', reference)).toBe('ativo');
  });

  it('vira "expirado" quando a vigência já passou', () => {
    expect(computeDisplayStatus('ativo', '2026-01-09', reference)).toBe('expirado');
  });

  it('mantém "ativo" quando não há data de fim (vigência indeterminada)', () => {
    expect(computeDisplayStatus('ativo', null, reference)).toBe('ativo');
  });

  it('não altera status que já não é "ativo"', () => {
    expect(computeDisplayStatus('encerrado', '2020-01-01', reference)).toBe('encerrado');
  });
});
