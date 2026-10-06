import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';

/** Tipos fixos da checklist de habilitação/regularidade — "outro" é a exceção que aceita várias linhas. */
export const CONTRACT_DOCUMENT_TYPES = [
  'cartao_cnpj',
  'contrato_social',
  'alvara',
  'cnd_federal',
  'crf_fgts',
  'cndt',
  'certidao_estadual',
  'certidao_municipal',
] as const;

export type FixedContractDocumentType = (typeof CONTRACT_DOCUMENT_TYPES)[number];
export type ContractDocumentType = FixedContractDocumentType | 'outro';

export const CONTRACT_DOCUMENT_TYPE_LABELS: Record<FixedContractDocumentType, string> = {
  cartao_cnpj: 'Cartão CNPJ',
  contrato_social: 'Contrato social / ato constitutivo',
  alvara: 'Alvará de funcionamento',
  cnd_federal: 'Certidão Negativa de Débitos Federais (CND/PGFN-RFB)',
  crf_fgts: 'Certidão de Regularidade do FGTS (CRF)',
  cndt: 'Certidão Negativa de Débitos Trabalhistas (CNDT)',
  certidao_estadual: 'Certidão de regularidade estadual (ICMS)',
  certidao_municipal: 'Certidão de regularidade municipal (ISS)',
};

export type ContractDocumentStatus = 'sem_documento' | 'regular' | 'vencendo' | 'vencido';

export const CONTRACT_DOCUMENT_STATUS_LABELS: Record<ContractDocumentStatus, string> = {
  sem_documento: 'Não anexado',
  regular: 'Regular',
  vencendo: 'Vencendo',
  vencido: 'Vencido',
};

/** Janela (dias corridos) antes do vencimento em que um documento passa a contar como "vencendo". */
export const DOCUMENT_EXPIRY_WARNING_DAYS = 30;

/**
 * Sem arquivo -> "sem_documento". Com arquivo mas sem validade cadastrada -> "regular" (a
 * presença já é o que importa, ex.: contrato social não tem prazo de validade). Com validade,
 * compara com a janela de aviso.
 */
export function computeDocumentStatus(
  filePath: string | null,
  validityDate: string | null,
  referenceDate: Date = new Date(),
): ContractDocumentStatus {
  if (!filePath) return 'sem_documento';
  if (!validityDate) return 'regular';

  const diff = differenceInCalendarDays(startOfDay(parseISO(validityDate)), startOfDay(referenceDate));
  if (diff < 0) return 'vencido';
  if (diff <= DOCUMENT_EXPIRY_WARNING_DAYS) return 'vencendo';
  return 'regular';
}
