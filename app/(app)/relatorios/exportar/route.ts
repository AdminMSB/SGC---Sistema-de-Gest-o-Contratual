import { NextResponse } from 'next/server';
import { requireProfile } from '@/lib/auth';
import { buildReportWorkbook } from '@/lib/report-excel';
import { parseReportParams } from '@/lib/reports';
import { loadReportData } from '../data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Exporta em Excel o mesmo relatório (e filtros) que está na tela. */
export async function GET(request: Request) {
  await requireProfile();

  const searchParams = new URL(request.url).searchParams;
  const params = Object.fromEntries([...new Set(searchParams.keys())].map((key) => [key, searchParams.getAll(key)]));
  const filters = parseReportParams(params);
  const { today, managerName, contracts, events } = await loadReportData(filters);

  const workbook = buildReportWorkbook(filters, contracts, events, managerName);
  const buffer = await workbook.xlsx.writeBuffer();
  const name = filters.tipo === 'contratos' ? 'contratos' : 'vencimentos-reajustes';
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="relatorio-${name}-${today}.xlsx"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
