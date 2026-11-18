import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import {
  EXPIRY_WINDOWS,
  REPORT_COLUMNS,
  REPORT_TYPE_LABELS,
  describeDays,
  parseReportParams,
  reportQuery,
  type ReportType,
} from '@/lib/reports';
import { formatDate } from '@/lib/format';
import { CONTRACT_TYPE_LABELS } from '@/types/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { loadReportData } from './data';

export const dynamic = 'force-dynamic';

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const profile = await requireProfile();
  const filters = parseReportParams(searchParams);
  const { managers, managerName, contracts, events } = await loadReportData(filters);
  const isAdmin = profile.role === 'admin';
  const selectedColumns = REPORT_COLUMNS.filter((column) => filters.cols.includes(column.key));
  const exportHref = `/relatorios/exportar?${reportQuery(filters)}`;
  const total = filters.tipo === 'contratos' ? contracts.length : events.length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? 'Dados de todos os contratos.' : 'Dados dos contratos em que você é o gestor responsável.'}
        </p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {(Object.keys(REPORT_TYPE_LABELS) as ReportType[]).map((tipo) => (
          <Link
            key={tipo}
            href={`/relatorios?tipo=${tipo}`}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              filters.tipo === tipo
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {REPORT_TYPE_LABELS[tipo]}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            {filters.tipo === 'contratos'
              ? 'Escolha os filtros e as colunas. A exportação em Excel usa exatamente o que está na tela.'
              : 'Contratos ativos com fim de vigência ou data-base de reajuste dentro do prazo escolhido.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-col gap-4">
            <input type="hidden" name="aplicado" value="1" />
            <input type="hidden" name="tipo" value={filters.tipo} />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {filters.tipo === 'contratos' ? (
                <>
                  <div>
                    <Label htmlFor="busca">Fornecedor ou CNPJ</Label>
                    <Input id="busca" name="busca" defaultValue={filters.busca} />
                  </div>
                  <div>
                    <Label htmlFor="status">Situação</Label>
                    <Select id="status" name="status" defaultValue={filters.status}>
                      <option value="todos">Todas</option>
                      <option value="ativo">Ativo</option>
                      <option value="inativo">Inativo</option>
                    </Select>
                  </div>
                </>
              ) : (
                <div>
                  <Label htmlFor="dias">Prazo</Label>
                  <Select id="dias" name="dias" defaultValue={String(filters.dias)}>
                    {EXPIRY_WINDOWS.map((days) => (
                      <option key={days} value={days}>
                        Próximos {days} dias
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <div>
                <Label htmlFor="categoria">Categoria</Label>
                <Select id="categoria" name="categoria" defaultValue={filters.categoria}>
                  <option value="">Todas</option>
                  {Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              {isAdmin && (
                <div>
                  <Label htmlFor="gestor">Gestor do contrato</Label>
                  <Select id="gestor" name="gestor" defaultValue={filters.gestor}>
                    <option value="">Todos</option>
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.full_name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              {filters.tipo === 'contratos' && (
                <>
                  <div>
                    <Label htmlFor="de">Vigente a partir de</Label>
                    <Input id="de" name="de" type="date" defaultValue={filters.de} />
                  </div>
                  <div>
                    <Label htmlFor="ate">Vigente até</Label>
                    <Input id="ate" name="ate" type="date" defaultValue={filters.ate} />
                  </div>
                </>
              )}
            </div>

            {filters.tipo === 'vencimentos' && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="vencidos" defaultChecked={filters.vencidos} />
                Incluir os que já passaram da data (vencidos)
              </label>
            )}

            {filters.tipo === 'contratos' && (
              <details className="rounded-md border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Colunas do relatório ({selectedColumns.length} selecionadas)
                </summary>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {REPORT_COLUMNS.map((column) => (
                    <label key={column.key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="cols"
                        value={column.key}
                        defaultChecked={filters.cols.includes(column.key)}
                      />
                      {column.label}
                    </label>
                  ))}
                </div>
              </details>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit">Aplicar filtros</Button>
              <Link
                href={`/relatorios?tipo=${filters.tipo}`}
                className="inline-flex h-10 items-center rounded-md px-4 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Limpar
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>{REPORT_TYPE_LABELS[filters.tipo]}</CardTitle>
            <CardDescription>
              {total} {total === 1 ? 'registro' : 'registros'}
            </CardDescription>
          </div>
          <a
            href={exportHref}
            className="inline-flex h-9 items-center rounded-md border border-border bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
          >
            Exportar Excel
          </a>
        </CardHeader>
        <CardContent>
          {filters.tipo === 'contratos' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  {selectedColumns.map((column) => (
                    <TableHead key={column.key}>{column.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((row) => (
                  <TableRow key={row.id}>
                    {selectedColumns.map((column) => (
                      <TableCell key={column.key}>
                        {column.key === 'fornecedor' ? (
                          <Link href={`/contratos/${row.id}`} className="text-primary hover:underline">
                            {column.text(row, { managerName })}
                          </Link>
                        ) : (
                          column.text(row, { managerName })
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {contracts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={Math.max(selectedColumns.length, 1)} className="text-center text-muted-foreground">
                      Nenhum contrato encontrado com esses filtros.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead>Gestor do contrato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={`${event.contractId}-${event.tipo}`}>
                    <TableCell>
                      <Link href={`/contratos/${event.contractId}`} className="text-primary hover:underline">
                        {event.fornecedor}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge tone={event.tipo === 'Vencimento' ? 'warning' : 'info'}>{event.tipo}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(event.data)}</TableCell>
                    <TableCell>
                      <Badge tone={event.dias < 0 ? 'destructive' : event.dias <= 30 ? 'warning' : 'neutral'}>
                        {describeDays(event.dias)}
                      </Badge>
                    </TableCell>
                    <TableCell>{managerName(event.gestorId)}</TableCell>
                  </TableRow>
                ))}
                {events.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nada vence ou reajusta nesse prazo.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
