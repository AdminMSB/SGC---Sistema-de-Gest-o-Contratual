import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { currentTurnSigners, generateSignatureToken, parseSigners, sha256Hex } from '@/lib/signature';
import { signingRank } from '@/lib/signature-limits';
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

  it('gera folha parcial listando quem ainda não assinou', async () => {
    const original = await PDFDocument.create();
    original.addPage();
    const signed = await appendSignatureSheet(await original.save(), {
      contractTitle: 'Contrato',
      requestId: 'req-3',
      documentHash: 'abc',
      signers: [{ name: 'Ana', role: 'Contratada', email: 'ana@x.com', signedAt: '2026-01-10T15:00:00Z', ip: null }],
      pending: [{ name: 'Bia', role: 'Testemunha', email: 'bia@x.com' }],
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

describe('ordem de assinatura', () => {
  const signers = [
    { id: 'a', role: 'testemunha', signed_at: null },
    { id: 'b', role: 'contratada', signed_at: null },
    { id: 'c', role: 'contratante', signed_at: '2026-01-01T00:00:00Z' },
    { id: 'd', role: 'testemunha', signed_at: null },
  ];

  it('libera só a etapa mais antiga ainda incompleta', () => {
    expect(currentTurnSigners(signers).map((signer) => signer.id)).toEqual(['b']);
  });

  it('libera todos os da mesma etapa ao mesmo tempo e ninguém quando todos assinaram', () => {
    const afterB = signers.map((signer) => (signer.id === 'b' ? { ...signer, signed_at: 'x' } : signer));
    expect(currentTurnSigners(afterB).map((signer) => signer.id)).toEqual(['a', 'd']);
    expect(currentTurnSigners(afterB.map((signer) => ({ ...signer, signed_at: 'x' })))).toEqual([]);
  });

  it('numera as etapas sem buracos', () => {
    const roles = ['testemunha', 'contratada', 'contratante', 'testemunha'];
    expect(roles.map((role) => signingRank(roles, role))).toEqual([3, 2, 1, 3]);
  });
});

describe('parseSigners', () => {
  it('aceita signatários válidos e ignora linhas vazias', () => {
    expect(parseSigners(['Ana', '', 'Bia'], ['ANA@x.com', '', 'bia@x.com'], ['', '', 'testemunha'])).toEqual({
      ok: true,
      signers: [
        { name: 'Ana', email: 'ana@x.com', role: 'contratante' },
        { name: 'Bia', email: 'bia@x.com', role: 'testemunha' },
      ],
    });
  });

  it('recusa e-mail inválido, nome ausente, lista vazia e e-mails repetidos', () => {
    expect(parseSigners(['Ana'], ['ana']).ok).toBe(false);
    expect(parseSigners([''], ['ana@x.com']).ok).toBe(false);
    expect(parseSigners([''], ['']).ok).toBe(false);
    expect(parseSigners(['A', 'B'], ['a@x.com', 'a@x.com']).ok).toBe(false);
    expect(parseSigners(['A'], ['a@x.com'], ['chefe']).ok).toBe(false);
  });
});
