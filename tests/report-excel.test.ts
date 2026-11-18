import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildReportWorkbook } from '@/lib/report-excel';
import { buildExpiryEvents, parseReportParams, type ContractRow } from '@/lib/reports';

const rows = [
  {
    id: 'c1',
    title: 'Fornecedor A',
    counterparty: 'Fornecedor A',
    contract_type: 'servico',
    status: 'ativo',
    start_date: '2026-01-15',
    end_date: '2030-12-31',
    total_amount_cents: 123456,
    is_variable_value: false,
    internal_manager_id: 'g1',
    readjustment_date: '2026-07-01',
  },
  {
    id: 'c2',
    title: 'Fornecedor B',
    counterparty: 'Fornecedor B',
    contract_type: 'locacao',
    status: 'ativo',
    start_date: '2026-02-01',
    end_date: null,
    total_amount_cents: null,
    is_variable_value: true,
    internal_manager_id: null,
    readjustment_date: null,
  },
] as ContractRow[];

const managerName = (id: string | null) => (id === 'g1' ? 'Maria Gestora' : '—');

async function roundTrip(workbook: ExcelJS.Workbook) {
  const buffer = await workbook.xlsx.writeBuffer();
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(buffer);
  return loaded.worksheets[0]!;
}

describe('buildReportWorkbook', () => {
  it('exporta contratos com cabeçalho, datas e valores tipados', async () => {
    const filters = parseReportParams({ aplicado: '1', cols: ['fornecedor', 'inicio', 'valor', 'gestor'] });
    const sheet = await roundTrip(buildReportWorkbook(filters, rows, [], managerName));

    expect(sheet.name).toBe('Contratos');
    expect(sheet.getRow(1).values).toEqual([undefined, 'Fornecedor', 'Início', 'Valor (R$)', 'Gestor do contrato']);
    const first = sheet.getRow(2);
    expect(first.getCell(1).value).toBe('Fornecedor A');
    expect(first.getCell(2).value).toBeInstanceOf(Date);
    expect((first.getCell(2).value as Date).toISOString().slice(0, 10)).toBe('2026-01-15');
    expect(first.getCell(3).value).toBe(1234.56);
    expect(first.getCell(4).value).toBe('Maria Gestora');
    // Valor variável fica como texto, não como número.
    expect(sheet.getRow(3).getCell(3).value).toBe('Variável');
  });

  it('exporta vencimentos e reajustes ordenados, com prazo descrito', async () => {
    const filters = parseReportParams({ aplicado: '1', tipo: 'vencimentos', dias: '30', vencidos: 'on' });
    const events = buildExpiryEvents(rows, filters, '2026-06-20');
    const sheet = await roundTrip(buildReportWorkbook(filters, [], events, managerName));

    expect(sheet.name).toBe('Vencimentos e reajustes');
    expect(sheet.rowCount).toBe(2);
    const row = sheet.getRow(2);
    expect(row.getCell(1).value).toBe('Fornecedor A');
    expect(row.getCell(2).value).toBe('Reajuste');
    expect(row.getCell(4).value).toBe('Em 11 dias');
    expect(row.getCell(6).value).toBe('Maria Gestora');
  });
});
