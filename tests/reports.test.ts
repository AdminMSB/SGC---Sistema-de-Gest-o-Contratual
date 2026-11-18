import { describe, expect, it } from 'vitest';
import {
  buildExpiryEvents,
  describeDays,
  filterContracts,
  parseReportParams,
  reportQuery,
  type ContractRow,
} from '@/lib/reports';

function contract(overrides: Partial<ContractRow>): ContractRow {
  return {
    id: 'c1',
    title: 'Fornecedor A',
    counterparty: 'Fornecedor A',
    contract_type: 'servico',
    status: 'ativo',
    start_date: '2026-01-01',
    end_date: null,
    internal_manager_id: 'g1',
    readjustment_date: null,
    counterparty_cnpj: null,
    ...overrides,
  } as ContractRow;
}

describe('parseReportParams', () => {
  it('usa padrões na primeira visita e ignora valores inválidos', () => {
    const filters = parseReportParams({ tipo: 'qualquer', status: 'x', categoria: 'y', dias: '7', de: 'ontem' });
    expect(filters.tipo).toBe('contratos');
    expect(filters.status).toBe('todos');
    expect(filters.categoria).toBe('');
    expect(filters.dias).toBe(60);
    expect(filters.de).toBe('');
    expect(filters.vencidos).toBe(true);
    expect(filters.cols.length).toBeGreaterThan(3);
  });

  it('respeita o formulário enviado (aplicado=1), inclusive caixa desmarcada e colunas escolhidas', () => {
    const filters = parseReportParams({
      aplicado: '1',
      tipo: 'vencimentos',
      dias: '90',
      cols: ['fornecedor', 'valor', 'inexistente'],
    });
    expect(filters.tipo).toBe('vencimentos');
    expect(filters.dias).toBe(90);
    expect(filters.vencidos).toBe(false);
    expect(filters.cols).toEqual(['fornecedor', 'valor']);
  });

  it('gera e relê a mesma consulta (link de exportação)', () => {
    const filters = parseReportParams({ aplicado: '1', status: 'ativo', busca: 'angio', cols: ['fornecedor', 'fim'] });
    const again = parseReportParams(Object.fromEntries(new URLSearchParams(reportQuery(filters)).entries()));
    expect(again.status).toBe('ativo');
    expect(again.busca).toBe('angio');
  });
});

describe('filterContracts', () => {
  const rows = [
    contract({ id: 'a', title: 'Alfa', end_date: '2030-01-01' }),
    contract({ id: 'b', title: 'Beta', contract_type: 'locacao', status: 'encerrado', end_date: '2026-03-01' }),
    contract({ id: 'c', title: 'Gama', internal_manager_id: 'g2', end_date: '2020-01-01' }),
  ];

  it('filtra por situação (expirado conta como inativo), categoria e gestor', () => {
    const base = parseReportParams({ aplicado: '1' });
    expect(filterContracts(rows, { ...base, status: 'ativo' }).map((r) => r.id)).toEqual(['a']);
    expect(filterContracts(rows, { ...base, status: 'inativo' }).map((r) => r.id)).toEqual(['b', 'c']);
    expect(filterContracts(rows, { ...base, categoria: 'locacao' }).map((r) => r.id)).toEqual(['b']);
    expect(filterContracts(rows, { ...base, gestor: 'g2' }).map((r) => r.id)).toEqual(['c']);
  });

  it('filtra por busca no nome e por vigência dentro do período', () => {
    const base = parseReportParams({ aplicado: '1' });
    expect(filterContracts(rows, { ...base, busca: 'alf' }).map((r) => r.id)).toEqual(['a']);
    expect(filterContracts(rows, { ...base, de: '2027-01-01' }).map((r) => r.id)).toEqual(['a']);
  });
});

describe('buildExpiryEvents', () => {
  const today = '2026-06-10';
  const rows = [
    contract({ id: 'a', title: 'Vence logo', end_date: '2026-06-25' }),
    contract({ id: 'b', title: 'Vence longe', end_date: '2027-06-25' }),
    contract({ id: 'c', title: 'Já venceu', end_date: '2026-06-01' }),
    contract({ id: 'd', title: 'Reajusta', end_date: null, readjustment_date: '2026-07-01' }),
    contract({ id: 'e', title: 'Encerrado', status: 'encerrado', end_date: '2026-06-20' }),
  ];

  it('lista vencimentos e reajustes dentro da janela, só de contratos ativos, em ordem de data', () => {
    const filters = { ...parseReportParams({ aplicado: '1', dias: '30', vencidos: 'on' }) };
    const events = buildExpiryEvents(rows, filters, today);
    expect(events.map((event) => `${event.fornecedor}:${event.tipo}`)).toEqual([
      'Já venceu:Vencimento',
      'Vence logo:Vencimento',
      'Reajusta:Reajuste',
    ]);
    expect(events[0]?.dias).toBe(-9);
  });

  it('omite os já vencidos quando a opção está desmarcada', () => {
    const filters = parseReportParams({ aplicado: '1', dias: '30' });
    expect(buildExpiryEvents(rows, filters, today).map((event) => event.contractId)).toEqual(['a', 'd']);
  });
});

describe('describeDays', () => {
  it('descreve passado, hoje e futuro com singular/plural', () => {
    expect(describeDays(0)).toBe('Hoje');
    expect(describeDays(1)).toBe('Em 1 dia');
    expect(describeDays(5)).toBe('Em 5 dias');
    expect(describeDays(-1)).toBe('Há 1 dia');
    expect(describeDays(-9)).toBe('Há 9 dias');
  });
});
