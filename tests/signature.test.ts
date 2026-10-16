import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generateSignatureToken, isSignableContractType, parseSigners, sha256Hex } from '@/lib/signature';
import { appendSignatureSheet } from '@/lib/signature-pdf';

describe('assinatura eletrônica', () => {
  it('gera tokens longos e diferentes entre si', () => {
    const a = generateSignatureToken();
    const b = generateSignatureToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });

  it('calcula o SHA-256 conhecido de um texto', () => {
    expect(sha256Hex(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('acrescenta uma folha de assinaturas ao PDF original', async () => {
    const original = await PDFDocument.create();
    original.addPage();
    const bytes = await original.save();

    const signed = await appendSignatureSheet(bytes, {
      contractTitle: 'Contrato de Prestação de Serviços — ação',
      requestId: 'req-1',
      documentHash: sha256Hex(bytes),
      signers: [{ name: 'João da Silva', email: 'joao@example.com', signedAt: '2026-01-10T15:00:00Z', ip: '1.2.3.4' }],
    });

    expect((await PDFDocument.load(signed)).getPageCount()).toBe(2);
  });

  it('gera só a folha quando não há PDF original legível', async () => {
    const signed = await appendSignatureSheet(new Uint8Array([1, 2, 3]), {
      contractTitle: 'Teste',
      requestId: 'req-2',
      documentHash: 'abc',
      signers: [],
    });
    expect((await PDFDocument.load(signed)).getPageCount()).toBe(1);
  });
});

describe('parseSigners', () => {
  it('aceita signatários válidos e ignora linhas vazias', () => {
    expect(parseSigners(['Ana', '', 'Bia'], ['ANA@x.com', '', 'bia@x.com'])).toEqual({
      ok: true,
      signers: [
        { name: 'Ana', email: 'ana@x.com' },
        { name: 'Bia', email: 'bia@x.com' },
      ],
    });
  });

  it('recusa e-mail inválido, nome ausente, lista vazia e e-mails repetidos', () => {
    expect(parseSigners(['Ana'], ['ana']).ok).toBe(false);
    expect(parseSigners([''], ['ana@x.com']).ok).toBe(false);
    expect(parseSigners([''], ['']).ok).toBe(false);
    expect(parseSigners(['A', 'B'], ['a@x.com', 'a@x.com']).ok).toBe(false);
  });

  it('só libera assinatura para serviço e locação', () => {
    expect(isSignableContractType('servico')).toBe(true);
    expect(isSignableContractType('locacao')).toBe(true);
    expect(isSignableContractType('comodato')).toBe(false);
  });
});
