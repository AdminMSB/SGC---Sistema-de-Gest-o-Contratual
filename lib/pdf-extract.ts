// Extração de destaques de contratos em PDF por padrões (regex), sem IA.
// Calibrado a partir de contratos reais da empresa: datas costumam vir por extenso ("01 de
// julho de 2025"), a vigência é frequentemente descrita como prazo ("prazo de 01 (um) ano" ou
// "365 dias"), e o reajuste aparece como "após 01 (um) ano de vigência" perto da palavra
// "reajuste"/"reajustado".

import type { ContractDetailType, ContractType, ReadjustmentIndex } from '@/types/domain';

// CNPJ da própria empresa (sempre a CONTRATANTE) — usado para não sugerir o próprio CNPJ como
// se fosse o da contraparte quando o contrato tem mais de um CNPJ mencionado.
const OWN_COMPANY_CNPJS = ['06.167.295/0001-71'];

const MONTHS_PT: Record<string, string> = {
  janeiro: '01',
  fevereiro: '02',
  março: '03',
  marco: '03',
  abril: '04',
  maio: '05',
  junho: '06',
  julho: '07',
  agosto: '08',
  setembro: '09',
  outubro: '10',
  novembro: '11',
  dezembro: '12',
};

const CLAUSE_KEYWORDS: { pattern: RegExp; label: string }[] = [
  { pattern: /renova(ç|c)[aã]o autom[aá]tica/i, label: 'Renovação automática' },
  { pattern: /renovad[oa]\s+por\s+escrito/i, label: 'Renovação mediante acordo entre as partes' },
  { pattern: /reajust\w+/i, label: 'Cláusula de reajuste de valores' },
  { pattern: /\bmulta\b/i, label: 'Cláusula de multa' },
  { pattern: /rescis[aã]o autom[aá]tica/i, label: 'Rescisão automática em caso de descumprimento' },
  { pattern: /sigilo|confidencial/i, label: 'Cláusula de confidencialidade/sigilo' },
  { pattern: /\bforo\b/i, label: 'Foro de eleição definido' },
];

const CONTRACT_TYPE_KEYWORDS: [RegExp, ContractType][] = [
  [/comodato/i, 'comodato'],
  [/loca(ç|c)[aã]o/i, 'locacao'],
  [/fornecimento/i, 'fornecimento'],
  [/consultoria/i, 'consultoria'],
  [/presta(ç|c)[aã]o de servi[çc]os/i, 'servico'],
];

const CONTRACT_DETAIL_TYPE_KEYWORDS: [RegExp, ContractDetailType][] = [
  [/manuten(ç|c)[aã]o/i, 'manutencao'],
  [/licen[çc]a de (uso|acesso)/i, 'licenca_uso'],
  [/m[aã]o[- ]de[- ]obra/i, 'mao_de_obra'],
  [/advocat[íi]ci[ao]s?/i, 'servicos_advocaticios'],
  [/gest[aã]o de viagens|ag[êe]ncia de viagens/i, 'gestao_viagens'],
  [/seguro\s+patrimonial/i, 'seguro_patrimonial'],
  [/seguro\s+predial/i, 'seguro_predial'],
  [/seguro\s+(de\s+)?auto(m[oó]vel|m[oó]veis)?\b/i, 'seguro_auto'],
];

const READJUSTMENT_INDEX_KEYWORDS: [RegExp, ReadjustmentIndex][] = [
  [/igp-?m/i, 'igpm'],
  [/ipca/i, 'ipca'],
  [/inpc/i, 'inpc'],
];

export interface ExtractedDuration {
  amount: number;
  unit: 'dias' | 'meses';
}

export interface ExtractedHighlights {
  dates: string[];
  amountsCents: number[];
  cnpjs: string[];
  duration: ExtractedDuration | null;
  readjustmentIndex: ReadjustmentIndex | null;
  readjustmentPeriodMonths: number | null;
  contractTypeGuess: ContractType | null;
  detailTypeGuess: ContractDetailType | null;
  objectSummary: string | null;
  clauses: string[];
}

export interface ExtractedSuggestions {
  startDate: string | null;
  endDate: string | null;
  amountCents: number | null;
  counterpartyCnpj: string | null;
  objectDescription: string | null;
  contractType: ContractType | null;
  contractDetailType: ContractDetailType | null;
  readjustmentIndex: ReadjustmentIndex | null;
  readjustmentPeriodMonths: number | null;
}

function normalizeCurrencyToCents(raw: string): number | null {
  const cleaned = raw.replace(/\./g, '').replace(',', '.');
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

function extractDatesTextual(text: string): string[] {
  const regex = /\b(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})\b/gi;
  const results: string[] = [];
  for (const match of text.matchAll(regex)) {
    const month = MONTHS_PT[match[2]!.toLowerCase()];
    if (!month) continue;
    results.push(`${match[3]}-${month}-${match[1]!.padStart(2, '0')}`);
  }
  return results;
}

function extractDatesNumeric(text: string): string[] {
  const regex = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
  const results: string[] = [];
  for (const match of text.matchAll(regex)) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      results.push(`${match[3]!}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    }
  }
  return results;
}

function extractAmounts(text: string): number[] {
  const regex = /R\$\s?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+,\d{2})/g;
  const results: number[] = [];
  for (const match of text.matchAll(regex)) {
    const cents = normalizeCurrencyToCents(match[1]!);
    if (cents != null && cents > 0) results.push(cents);
  }
  return results;
}

function extractCnpjs(text: string): string[] {
  return Array.from(new Set(text.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g) ?? []));
}

/** Prazo de vigência: aceita dias, meses ou anos ("prazo de 01 (um) ano", "prazo de 365 dias"). */
function extractDuration(text: string): ExtractedDuration | null {
  const regex = /\bprazo\s+de\s+(\d{1,4})\s*(?:\([a-zç]+\))?\s*(dias?|anos?|m[eê]s(?:es)?)\b/i;
  const match = text.match(regex);
  if (!match) return null;
  const amount = Number.parseInt(match[1]!, 10);
  const unitText = match[2]!.toLowerCase();
  if (unitText.startsWith('dia')) return { amount, unit: 'dias' };
  return { amount: unitText.startsWith('ano') ? amount * 12 : amount, unit: 'meses' };
}

/** Período de reajuste: procura uma duração próxima da palavra "reajuste"/"reajustado". */
function extractReadjustmentPeriodMonths(text: string): number | null {
  const keywordIndex = text.search(/reajust\w+/i);
  if (keywordIndex === -1) return null;
  const window = text.slice(keywordIndex, keywordIndex + 200);
  const match = window.match(/(\d{1,2})\s*(?:\([a-zç]+\))?\s*(anos?|m[eê]s(?:es)?)\b/i);
  if (!match) return null;
  const amount = Number.parseInt(match[1]!, 10);
  return match[2]!.toLowerCase().startsWith('ano') ? amount * 12 : amount;
}

function guessReadjustmentIndex(text: string): ReadjustmentIndex | null {
  for (const [pattern, index] of READJUSTMENT_INDEX_KEYWORDS) {
    if (pattern.test(text)) return index;
  }
  return /reajust\w+/i.test(text) ? 'outro' : null;
}

function guessFromKeywords<T extends string>(text: string, keywords: [RegExp, T][]): T | null {
  for (const [pattern, value] of keywords) {
    if (pattern.test(text)) return value;
  }
  return null;
}

/** Excerto do texto da cláusula de objeto ("CLÁUSULA ... DO OBJETO ... até a próxima cláusula"). */
function extractObjectSummary(text: string): string | null {
  const match = text.match(/CL[ÁA]USULA[^.]{0,30}OBJETO\s*[-–:]*\s*(.*?)(?=CL[ÁA]USULA\s)/i);
  if (!match) return null;
  const summary = match[1]!.trim().replace(/^\d+(\.\d+)?\s*/, '');
  if (!summary) return null;
  return summary.length > 500 ? `${summary.slice(0, 500).trim()}…` : summary;
}

function extractClauses(text: string): string[] {
  return CLAUSE_KEYWORDS.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label);
}

export function extractHighlightsFromText(rawText: string): ExtractedHighlights {
  const text = rawText.replace(/\s+/g, ' ');
  const cnpjs = extractCnpjs(text);
  return {
    dates: Array.from(new Set([...extractDatesTextual(text), ...extractDatesNumeric(text)])).sort(),
    amountsCents: Array.from(new Set(extractAmounts(text))).sort((a, b) => b - a),
    cnpjs,
    duration: extractDuration(text),
    readjustmentIndex: guessReadjustmentIndex(text),
    readjustmentPeriodMonths: extractReadjustmentPeriodMonths(text),
    contractTypeGuess: guessFromKeywords(text, CONTRACT_TYPE_KEYWORDS),
    detailTypeGuess: guessFromKeywords(text, CONTRACT_DETAIL_TYPE_KEYWORDS),
    objectSummary: extractObjectSummary(text),
    clauses: extractClauses(text),
  };
}

function addToIsoDate(iso: string, duration: ExtractedDuration): string {
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
  const date =
    duration.unit === 'dias'
      ? new Date(Date.UTC(year, month - 1, day + duration.amount))
      : new Date(Date.UTC(year, month - 1 + duration.amount, day));
  return date.toISOString().slice(0, 10);
}

function findMonthlyAmountCents(rawText: string, amountsCents: number[]): number | null {
  if (amountsCents.length === 0) return null;
  const text = rawText.replace(/\s+/g, ' ');
  const match = text.match(/mensal\w*[^.]{0,60}?R\$\s?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+,\d{2})/i);
  const nearMonthly = match ? normalizeCurrencyToCents(match[1]!) : null;
  return nearMonthly ?? amountsCents[0] ?? null;
}

function findCounterpartyCnpj(cnpjs: string[]): string | null {
  const candidates = cnpjs.filter((cnpj) => !OWN_COMPANY_CNPJS.includes(cnpj));
  return candidates[0] ?? null;
}

/** Sugestões para pré-preencher o formulário; nunca sobrescreve campos já preenchidos pelo usuário. */
export function deriveSuggestions(rawText: string, highlights: ExtractedHighlights): ExtractedSuggestions {
  const startDate = highlights.dates[0] ?? null;
  let endDate: string | null = null;
  if (startDate && highlights.duration) {
    endDate = addToIsoDate(startDate, highlights.duration);
  } else if (highlights.dates.length > 1) {
    endDate = highlights.dates[highlights.dates.length - 1]!;
  }
  return {
    startDate,
    endDate,
    amountCents: findMonthlyAmountCents(rawText, highlights.amountsCents),
    counterpartyCnpj: findCounterpartyCnpj(highlights.cnpjs),
    objectDescription: highlights.objectSummary,
    contractType: highlights.contractTypeGuess,
    contractDetailType: highlights.detailTypeGuess,
    readjustmentIndex: highlights.readjustmentIndex,
    readjustmentPeriodMonths: highlights.readjustmentPeriodMonths,
  };
}
