import { describe, expect, it } from 'vitest';
import { deriveSuggestions, extractHighlightsFromText } from '@/lib/pdf-extract';

const SAMPLE_CONTRACT_TEXT = `
CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE CONSULTORIA

CONTRATANTE, inscrita no CNPJ n. 06.167.295/0001-71, e CONTRATADO, inscrito no CNPJ n.
98.765.432/0001-10, têm entre si justo e acordado o presente contrato.

CLÁUSULA PRIMEIRA – DO OBJETO
1.1 O presente Contrato tem por objeto a prestação de serviços de consultoria comercial e
vendas para a linha de produtos da CONTRATANTE em todo o território nacional.

CLÁUSULA QUINTA - DA REMUNERAÇÃO
5.1 A CONTRATANTE pagará, mensalmente, o valor de R$ 3.200,00 (três mil e duzentos reais).
5.2 O valor poderá ser reajustado através de percentual de reajuste a ser definido, em comum
acordo entre as partes, após 01 (um) ano de vigência deste Contrato.

CLÁUSULA SEXTA - DA RESCISÃO
A violação das obrigações implica a rescisão automática do presente contrato.

CLÁUSULA SÉTIMA - DO SIGILO
As partes se comprometem a manter sigilo sobre informações confidenciais.

CLÁUSULA OITAVA - DO PRAZO
Este Contrato vigorará pelo prazo de 01 (um) ano a contar da data de assinatura.

CLÁUSULA NONA - DO FORO
As partes elegem o foro da Comarca de São Paulo.

São Paulo, 10 de março de 2026.
`;

describe('extractHighlightsFromText', () => {
  it('extrai datas por extenso e converte para ISO', () => {
    const { dates } = extractHighlightsFromText(SAMPLE_CONTRACT_TEXT);
    expect(dates).toEqual(['2026-03-10']);
  });

  it('extrai datas numéricas (dd/mm/aaaa)', () => {
    const { dates } = extractHighlightsFromText('Assinado em 05/01/2026 pelas partes.');
    expect(dates).toEqual(['2026-01-05']);
  });

  it('extrai valores em reais e ordena do maior para o menor', () => {
    const { amountsCents } = extractHighlightsFromText(
      'Valor mensal de R$ 1.000,00 e multa de R$500,00.',
    );
    expect(amountsCents).toEqual([100000, 50000]);
  });

  it('extrai CNPJs mencionados', () => {
    const { cnpjs } = extractHighlightsFromText(SAMPLE_CONTRACT_TEXT);
    expect(cnpjs).toEqual(['06.167.295/0001-71', '98.765.432/0001-10']);
  });

  it('extrai o prazo de vigência em meses a partir de "prazo de X (extenso) ano(s)/mês(es)"', () => {
    expect(extractHighlightsFromText(SAMPLE_CONTRACT_TEXT).duration).toEqual({
      amount: 12,
      unit: 'meses',
    });
  });

  it('extrai o prazo de vigência em dias quando expresso em dias', () => {
    expect(extractHighlightsFromText('prazo de 365 dias de vigência.').duration).toEqual({
      amount: 365,
      unit: 'dias',
    });
    expect(extractHighlightsFromText('prazo de 6 (seis) meses de vigência.').duration).toEqual({
      amount: 6,
      unit: 'meses',
    });
  });

  it('extrai o período de reajuste (meses) a partir do texto próximo de "reajuste"', () => {
    expect(extractHighlightsFromText(SAMPLE_CONTRACT_TEXT).readjustmentPeriodMonths).toBe(12);
  });

  it('detecta o índice de reajuste quando mencionado (IGPM/IPCA/INPC) ou "outro" caso genérico', () => {
    expect(extractHighlightsFromText('Reajuste anual pelo IGPM.').readjustmentIndex).toBe('igpm');
    expect(extractHighlightsFromText('Reajuste anual pelo IPCA.').readjustmentIndex).toBe('ipca');
    expect(extractHighlightsFromText(SAMPLE_CONTRACT_TEXT).readjustmentIndex).toBe('outro');
    expect(extractHighlightsFromText('Sem nenhuma menção a valores.').readjustmentIndex).toBeNull();
  });

  it('sugere a categoria do contrato por palavra-chave', () => {
    // O texto de exemplo é um contrato de consultoria — "consultoria" tem prioridade sobre o
    // termo genérico "prestação de serviços" que também aparece nele.
    expect(extractHighlightsFromText(SAMPLE_CONTRACT_TEXT).contractTypeGuess).toBe('consultoria');
    expect(extractHighlightsFromText('Contrato de comodato de equipamentos.').contractTypeGuess).toBe(
      'comodato',
    );
    expect(extractHighlightsFromText('Contrato de locação do imóvel.').contractTypeGuess).toBe('locacao');
    expect(
      extractHighlightsFromText('Contrato de prestação de serviços de limpeza predial.').contractTypeGuess,
    ).toBe('servico');
  });

  it('sugere o detalhamento do contrato por palavra-chave', () => {
    expect(extractHighlightsFromText('Contrato de manutenção predial.').detailTypeGuess).toBe('manutencao');
    expect(extractHighlightsFromText('Licença de uso do software.').detailTypeGuess).toBe('licenca_uso');
    expect(extractHighlightsFromText('Contrato de seguro patrimonial da sede.').detailTypeGuess).toBe(
      'seguro_patrimonial',
    );
    expect(extractHighlightsFromText('Apólice de seguro predial do galpão.').detailTypeGuess).toBe(
      'seguro_predial',
    );
    expect(extractHighlightsFromText('Contrato de seguro de auto da frota.').detailTypeGuess).toBe(
      'seguro_auto',
    );
    expect(extractHighlightsFromText(SAMPLE_CONTRACT_TEXT).detailTypeGuess).toBeNull();
  });

  it('extrai um resumo do objeto a partir da cláusula correspondente', () => {
    const { objectSummary } = extractHighlightsFromText(SAMPLE_CONTRACT_TEXT);
    expect(objectSummary).toContain('prestação de serviços de consultoria comercial');
  });

  it('detecta cláusulas notáveis por palavra-chave', () => {
    const { clauses } = extractHighlightsFromText(SAMPLE_CONTRACT_TEXT);
    expect(clauses).toEqual(
      expect.arrayContaining([
        'Cláusula de reajuste de valores',
        'Rescisão automática em caso de descumprimento',
        'Cláusula de confidencialidade/sigilo',
        'Foro de eleição definido',
      ]),
    );
  });

  it('retorna vazio/nulo quando nada é encontrado', () => {
    const highlights = extractHighlightsFromText('Texto qualquer sem nenhum padrão relevante.');
    expect(highlights).toEqual({
      dates: [],
      amountsCents: [],
      cnpjs: [],
      duration: null,
      readjustmentIndex: null,
      readjustmentPeriodMonths: null,
      contractTypeGuess: null,
      detailTypeGuess: null,
      objectSummary: null,
      clauses: [],
    });
  });
});

describe('deriveSuggestions', () => {
  it('sugere início = data encontrada e fim = início + prazo de vigência', () => {
    const highlights = extractHighlightsFromText(SAMPLE_CONTRACT_TEXT);
    const suggestions = deriveSuggestions(SAMPLE_CONTRACT_TEXT, highlights);
    expect(suggestions.startDate).toBe('2026-03-10');
    expect(suggestions.endDate).toBe('2027-03-10');
  });

  it('soma dias corretamente quando o prazo é expresso em dias', () => {
    const text = 'Assinado em 01/01/2026. Contrato com prazo de 10 dias de vigência.';
    const highlights = extractHighlightsFromText(text);
    const suggestions = deriveSuggestions(text, highlights);
    expect(suggestions.endDate).toBe('2026-01-11');
  });

  it('prefere o valor mencionado perto de "mensal" ao sugerir o valor da parcela', () => {
    const text = 'Multa de R$ 9.000,00. Pagamento mensal de R$ 1.500,00 pelos serviços.';
    const highlights = extractHighlightsFromText(text);
    const suggestions = deriveSuggestions(text, highlights);
    expect(suggestions.amountCents).toBe(150000);
  });

  it('sugere o CNPJ da contraparte excluindo o CNPJ da própria empresa', () => {
    const highlights = extractHighlightsFromText(SAMPLE_CONTRACT_TEXT);
    const suggestions = deriveSuggestions(SAMPLE_CONTRACT_TEXT, highlights);
    expect(suggestions.counterpartyCnpj).toBe('98.765.432/0001-10');
  });

  it('usa a última data encontrada como fim quando há múltiplas datas e nenhum prazo explícito', () => {
    const text = 'Início em 01/02/2026. Término em 01/02/2027.';
    const highlights = extractHighlightsFromText(text);
    const suggestions = deriveSuggestions(text, highlights);
    expect(suggestions.startDate).toBe('2026-02-01');
    expect(suggestions.endDate).toBe('2027-02-01');
  });

  it('não sugere nada quando não há dados extraídos', () => {
    const highlights = extractHighlightsFromText('Sem padrões aqui.');
    const suggestions = deriveSuggestions('Sem padrões aqui.', highlights);
    expect(suggestions).toEqual({
      startDate: null,
      endDate: null,
      amountCents: null,
      counterpartyCnpj: null,
      objectDescription: null,
      contractType: null,
      contractDetailType: null,
      readjustmentIndex: null,
      readjustmentPeriodMonths: null,
    });
  });
});
