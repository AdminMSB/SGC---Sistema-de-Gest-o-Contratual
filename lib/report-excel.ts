import ExcelJS from 'exceljs';
import {
  REPORT_COLUMNS,
  REPORT_TYPE_LABELS,
  describeDays,
  type ContractRow,
  type ExpiryEvent,
  type ReportFilters,
} from '@/lib/reports';

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };

/** Data ISO (yyyy-mm-dd) como data do Excel, ao meio-dia UTC para não "voltar um dia" por fuso. */
function toExcelDate(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

function styleHeader(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = HEADER_FILL;
  header.alignment = { vertical: 'middle' };
  header.height = 22;
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
}

/** Monta a planilha do relatório: as mesmas colunas e linhas que aparecem na tela. */
export function buildReportWorkbook(
  filters: ReportFilters,
  contracts: ContractRow[],
  events: ExpiryEvent[],
  managerName: (id: string | null) => string,
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SGC - Sistema de Gestão Contratual';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(REPORT_TYPE_LABELS[filters.tipo]);

  if (filters.tipo === 'contratos') {
    const columns = REPORT_COLUMNS.filter((column) => filters.cols.includes(column.key));
    sheet.columns = columns.map((column) => ({ header: column.label, key: column.key, width: column.width }));
    for (const row of contracts) {
      const values: Record<string, string | number | Date | null> = {};
      for (const column of columns) {
        const raw = column.raw?.(row);
        if (column.kind === 'date') {
          values[column.key] = raw ? toExcelDate(String(raw)) : column.text(row, { managerName });
        } else if (column.kind === 'money') {
          values[column.key] = typeof raw === 'number' ? raw : column.text(row, { managerName });
        } else {
          values[column.key] = column.raw ? (raw ?? '—') : column.text(row, { managerName });
        }
      }
      sheet.addRow(values);
    }
    columns.forEach((column, index) => {
      if (column.kind === 'date') sheet.getColumn(index + 1).numFmt = 'dd/mm/yyyy';
      if (column.kind === 'money') sheet.getColumn(index + 1).numFmt = '"R$" #,##0.00';
    });
  } else {
    sheet.columns = [
      { header: 'Fornecedor', key: 'fornecedor', width: 36 },
      { header: 'Evento', key: 'tipo', width: 14 },
      { header: 'Data', key: 'data', width: 13 },
      { header: 'Prazo', key: 'prazo', width: 16 },
      { header: 'Dias', key: 'dias', width: 8 },
      { header: 'Gestor do contrato', key: 'gestor', width: 28 },
    ];
    for (const event of events) {
      sheet.addRow({
        fornecedor: event.fornecedor,
        tipo: event.tipo,
        data: toExcelDate(event.data),
        prazo: describeDays(event.dias),
        dias: event.dias,
        gestor: managerName(event.gestorId),
      });
    }
    sheet.getColumn(3).numFmt = 'dd/mm/yyyy';
  }

  styleHeader(sheet);
  return workbook;
}
