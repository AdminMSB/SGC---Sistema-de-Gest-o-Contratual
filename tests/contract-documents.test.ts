import { describe, expect, it } from 'vitest';
import { computeDocumentStatus } from '@/lib/contract-documents';

describe('computeDocumentStatus', () => {
  const reference = new Date('2026-01-10T12:00:00Z');

  it('"sem_documento" quando não há arquivo anexado', () => {
    expect(computeDocumentStatus(null, null, reference)).toBe('sem_documento');
    expect(computeDocumentStatus(null, '2026-02-01', reference)).toBe('sem_documento');
  });

  it('"regular" quando tem arquivo mas não tem validade (ex.: contrato social)', () => {
    expect(computeDocumentStatus('doc.pdf', null, reference)).toBe('regular');
  });

  it('"regular" quando a validade está fora da janela de aviso', () => {
    expect(computeDocumentStatus('doc.pdf', '2026-03-01', reference)).toBe('regular');
  });

  it('"vencendo" quando a validade está dentro da janela de 30 dias', () => {
    expect(computeDocumentStatus('doc.pdf', '2026-01-25', reference)).toBe('vencendo');
  });

  it('"vencido" quando a validade já passou', () => {
    expect(computeDocumentStatus('doc.pdf', '2026-01-01', reference)).toBe('vencido');
  });
});
