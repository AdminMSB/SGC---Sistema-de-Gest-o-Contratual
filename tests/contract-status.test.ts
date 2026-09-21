import { describe, expect, it } from 'vitest';
import { computeDisplayStatus, computeVigenciaCountdown } from '@/lib/contract-status';

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

describe('computeVigenciaCountdown', () => {
  const reference = new Date('2026-01-10T12:00:00Z');

  it('retorna null quando não há data de fim', () => {
    expect(computeVigenciaCountdown(null, reference)).toBeNull();
  });

  it('marca como vencido (vermelho) quando a data já passou', () => {
    expect(computeVigenciaCountdown('2026-01-05', reference)).toEqual({
      label: 'Vencido há 5 dia(s)',
      tone: 'destructive',
    });
  });

  it('marca em dias (amarelo) quando falta menos de 30 dias', () => {
    expect(computeVigenciaCountdown('2026-01-20', reference)).toEqual({
      label: 'Faltam 10 dia(s)',
      tone: 'warning',
    });
  });

  it('marca em meses (neutro) quando falta 30 dias ou mais', () => {
    expect(computeVigenciaCountdown('2026-04-10', reference)).toEqual({
      label: 'Faltam 3 mês(es)',
      tone: 'neutral',
    });
  });
});
