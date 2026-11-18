import { differenceInCalendarDays, parseISO } from 'date-fns';
import { computeDisplayStatus } from '@/lib/contract-status';
import { formatCurrencyCents, formatDate } from '@/lib/format';
import {
  CONTRACT_DETAIL_TYPE_LABELS,
  CONTRACT_TYPE_LABELS,
  DEPARTMENT_LABELS,
  PAYMENT_PERIODICITY_LABELS,
  READJUSTMENT_INDEX_LABELS,
  type ContractDetailType,
  type ContractType,
  type Department,
} from '@/types/domain';
import type { Database } from '@/types/database';

export type ContractRow = Database['public']['Tables']['contracts']['Row'];

export type ReportType = 'contratos' | 'vencimentos';
export type StatusFilter = 'todos' | 'ativo' | 'inativo';

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  contratos: 'Contratos',
  vencimentos: 'Vencimentos e reajustes',
};

export const EXPIRY_WINDOWS = [30, 60, 90, 180] as const;

export interface ReportFilters {
  tipo: ReportType;
  status: StatusFilter;
  categoria: string;
  gestor: string;
  busca: string;
  de: string;
  ate: string;
  cols: string[];
  dias: number;
  vencidos: boolean;
}

interface ColumnContext {
  managerName: (id: string | null) => string;
}

export interface ReportColumn {
  key: string;
  label: string;
  kind: 'text' | 'date' | 'money';
  width: number;
  defaultOn: boolean;
  /** Texto para a tela. */
  text: (row: ContractRow, ctx: ColumnContext) => string;
  /** Valor tipado para o Excel (data ISO, número em reais ou texto). */
  raw?: (row: ContractRow) => string | number | null;
}

const dash = (value: string | null | undefined) => (value && value.trim() ? value : '—');
const dateText = (value: string | null) => (value ? formatDate(value) : '—');

export const REPORT_COLUMNS: ReportColumn[] = [
  { key: 'fornecedor', label: 'Fornecedor', kind: 'text', width: 34, defaultOn: true, text: (r) => r.title },
  { key: 'cnpj', label: 'CNPJ', kind: 'text', width: 20, defaultOn: true, text: (r) => dash(r.counterparty_cnpj) },
  { key: 'categoria', label: 'Categoria', kind: 'text', width: 16, defaultOn: true, text: (r) => CONTRACT_TYPE_LABELS[r.contract_type] },
  {
    key: 'detalhamento',
    label: 'Detalhamento',
    kind: 'text',
    width: 26,
    defaultOn: false,
    text: (r) =>
      r.contract_detail_type
        ? (CONTRACT_DETAIL_TYPE_LABELS[r.contract_detail_type as ContractDetailType] ?? r.contract_detail_type)
        : '—',
  },
  {
    key: 'situacao',
    label: 'Situação',
    kind: 'text',
    width: 12,
    defaultOn: true,
    text: (r) => (computeDisplayStatus(r.status, r.end_date) === 'ativo' ? 'Ativo' : 'Inativo'),
  },
  { key: 'inicio', label: 'Início', kind: 'date', width: 12, defaultOn: true, text: (r) => dateText(r.start_date), raw: (r) => r.start_date },
  { key: 'fim', label: 'Fim da vigência', kind: 'date', width: 16, defaultOn: true, text: (r) => (r.end_date ? formatDate(r.end_date) : 'Indeterminado'), raw: (r) => r.end_date },
  {
    key: 'aviso',
    label: 'Aviso prévio (dias)',
    kind: 'text',
    width: 18,
    defaultOn: false,
    text: (r) => (r.renewal_notice_days != null ? String(r.renewal_notice_days) : '—'),
    raw: (r) => r.renewal_notice_days,
  },
  {
    key: 'valor',
    label: 'Valor (R$)',
    kind: 'money',
    width: 16,
    defaultOn: true,
    text: (r) => (r.is_variable_value ? 'Variável' : formatCurrencyCents(r.total_amount_cents ?? 0)),
    raw: (r) => (r.is_variable_value || r.total_amount_cents == null ? null : r.total_amount_cents / 100),
  },
  {
    key: 'periodicidade',
    label: 'Periodicidade',
    kind: 'text',
    width: 15,
    defaultOn: true,
    text: (r) => (r.payment_periodicity ? PAYMENT_PERIODICITY_LABELS[r.payment_periodicity] : '—'),
  },
  {
    key: 'reajuste',
    label: 'Índice de reajuste',
    kind: 'text',
    width: 17,
    defaultOn: false,
    text: (r) => (r.readjustment_index ? READJUSTMENT_INDEX_LABELS[r.readjustment_index] : '—'),
  },
  { key: 'database', label: 'Data-base do reajuste', kind: 'date', width: 20, defaultOn: false, text: (r) => dateText(r.readjustment_date), raw: (r) => r.readjustment_date },
  { key: 'gestor', label: 'Gestor do contrato', kind: 'text', width: 26, defaultOn: true, text: (r, ctx) => ctx.managerName(r.internal_manager_id) },
  { key: 'codigo', label: 'Código de contrato', kind: 'text', width: 18, defaultOn: false, text: (r) => dash(r.internal_code) },
  { key: 'codigo_fornecedor', label: 'Código do fornecedor', kind: 'text', width: 20, defaultOn: false, text: (r) => dash(r.supplier_code) },
  {
    key: 'centro_custo',
    label: 'Centro de custo',
    kind: 'text',
    width: 22,
    defaultOn: false,
    text: (r) => (r.department ? (DEPARTMENT_LABELS[r.department as Department] ?? r.department) : '—'),
  },
  { key: 'contato', label: 'Contato', kind: 'text', width: 24, defaultOn: false, text: (r) => dash(r.representative_name) },
  { key: 'email', label: 'E-mail de contato', kind: 'text', width: 28, defaultOn: false, text: (r) => dash(r.contact_email) },
];

const DEFAULT_COLS = REPORT_COLUMNS.filter((column) => column.defaultOn).map((column) => column.key);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

/** Lê os filtros da URL, com padrões seguros para qualquer valor inválido. */
export function parseReportParams(params: RawParams): ReportFilters {
  const submitted = first(params.aplicado) === '1';
  const tipo: ReportType = first(params.tipo) === 'vencimentos' ? 'vencimentos' : 'contratos';
  const status = (['ativo', 'inativo'] as const).find((value) => value === first(params.status)) ?? 'todos';
  const categoria = first(params.categoria) in CONTRACT_TYPE_LABELS ? first(params.categoria) : '';

  const rawCols = ([] as string[]).concat(params.cols ?? []);
  const validCols = rawCols.filter((key) => REPORT_COLUMNS.some((column) => column.key === key));
  const cols = submitted && validCols.length > 0 ? validCols : DEFAULT_COLS;

  const dias = Number(first(params.dias));
  return {
    tipo,
    status,
    categoria,
    gestor: first(params.gestor),
    busca: first(params.busca).trim(),
    de: ISO_DATE.test(first(params.de)) ? first(params.de) : '',
    ate: ISO_DATE.test(first(params.ate)) ? first(params.ate) : '',
    cols,
    dias: (EXPIRY_WINDOWS as readonly number[]).includes(dias) ? dias : 60,
    vencidos: submitted ? first(params.vencidos) === 'on' : true,
  };
}

/** Filtra contratos para o relatório "Contratos". */
export function filterContracts(rows: ContractRow[], filters: ReportFilters): ContractRow[] {
  const term = filters.busca.toLowerCase();
  return rows.filter((row) => {
    if (filters.status !== 'todos') {
      const active = computeDisplayStatus(row.status, row.end_date) === 'ativo';
      if (filters.status === 'ativo' ? !active : active) return false;
    }
    if (filters.categoria && row.contract_type !== filters.categoria) return false;
    if (filters.gestor && row.internal_manager_id !== filters.gestor) return false;
    if (term && !row.title.toLowerCase().includes(term) && !(row.counterparty_cnpj ?? '').includes(term)) return false;
    // Vigente em algum momento dentro do período informado.
    if (filters.ate && row.start_date > filters.ate) return false;
    if (filters.de && row.end_date && row.end_date < filters.de) return false;
    return true;
  });
}

export interface ExpiryEvent {
  contractId: string;
  fornecedor: string;
  tipo: 'Vencimento' | 'Reajuste';
  data: string;
  /** Dias até a data (negativo = já passou). */
  dias: number;
  gestorId: string | null;
}

/** Vencimentos (fim da vigência) e reajustes (data-base) dos contratos ativos dentro da janela. */
export function buildExpiryEvents(rows: ContractRow[], filters: ReportFilters, todayIso: string): ExpiryEvent[] {
  const today = parseISO(todayIso);
  const events: ExpiryEvent[] = [];

  for (const row of filters.gestor ? rows.filter((item) => item.internal_manager_id === filters.gestor) : rows) {
    if (row.status !== 'ativo') continue;
    if (filters.categoria && row.contract_type !== filters.categoria) continue;
    const candidates: [ExpiryEvent['tipo'], string | null][] = [
      ['Vencimento', row.end_date],
      ['Reajuste', row.readjustment_date],
    ];
    for (const [tipo, date] of candidates) {
      if (!date) continue;
      const dias = differenceInCalendarDays(parseISO(date), today);
      if (dias > filters.dias) continue;
      if (dias < 0 && !filters.vencidos) continue;
      events.push({ contractId: row.id, fornecedor: row.title, tipo, data: date, dias, gestorId: row.internal_manager_id });
    }
  }
  return events.sort((a, b) => a.data.localeCompare(b.data) || a.fornecedor.localeCompare(b.fornecedor));
}

export function describeDays(dias: number): string {
  if (dias === 0) return 'Hoje';
  if (dias > 0) return `Em ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  const past = Math.abs(dias);
  return `Há ${past} ${past === 1 ? 'dia' : 'dias'}`;
}

/** Query string com os filtros atuais (usada no link de exportação). */
export function reportQuery(filters: ReportFilters): string {
  const query = new URLSearchParams({ aplicado: '1', tipo: filters.tipo });
  if (filters.status !== 'todos') query.set('status', filters.status);
  if (filters.categoria) query.set('categoria', filters.categoria);
  if (filters.gestor) query.set('gestor', filters.gestor);
  if (filters.busca) query.set('busca', filters.busca);
  if (filters.de) query.set('de', filters.de);
  if (filters.ate) query.set('ate', filters.ate);
  query.set('dias', String(filters.dias));
  if (filters.vencidos) query.set('vencidos', 'on');
  for (const col of filters.cols) query.append('cols', col);
  return query.toString();
}

/** Data de hoje (yyyy-mm-dd) em horário de Brasília, independente do fuso do servidor. */
export function todayInBrazil(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export function contractTypeLabel(type: string): string {
  return CONTRACT_TYPE_LABELS[type as ContractType] ?? type;
}
