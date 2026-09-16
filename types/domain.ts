export type Role = 'membro' | 'admin';

export type ContractType = 'servico' | 'locacao' | 'fornecimento' | 'comodato' | 'consultoria';
export type ContractDetailType =
  | 'manutencao'
  | 'licenca_uso'
  | 'mao_de_obra'
  | 'prestacao_servico_terceiros'
  | 'servicos_advocaticios'
  | 'gestao_viagens'
  | 'seguro_patrimonial'
  | 'seguro_predial'
  | 'seguro_auto'
  | 'outro';
export type ContractStatus = 'ativo' | 'encerrado' | 'cancelado';
export type ReadjustmentIndex = 'igpm' | 'ipca' | 'inpc' | 'outro';
export type AmendmentStatus = 'em_analise' | 'assinado';

export interface CurrentProfile {
  id: string;
  fullName: string;
  role: Role;
}

export const ROLE_LABELS: Record<Role, string> = {
  membro: 'Membro',
  admin: 'Administrador',
};

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  servico: 'Serviço',
  locacao: 'Locação',
  fornecimento: 'Fornecimento',
  comodato: 'Comodato',
  consultoria: 'Consultoria',
};

export const CONTRACT_DETAIL_TYPE_LABELS: Record<ContractDetailType, string> = {
  manutencao: 'Manutenção',
  licenca_uso: 'Licença de uso/acesso',
  mao_de_obra: 'Mão de obra',
  prestacao_servico_terceiros: 'Prestação de serviço de terceiros',
  servicos_advocaticios: 'Serviços advocatícios',
  gestao_viagens: 'Gestão de viagens',
  seguro_patrimonial: 'Seguro patrimonial',
  seguro_predial: 'Seguro predial',
  seguro_auto: 'Seguro de auto',
  outro: 'Outro',
};

export const READJUSTMENT_INDEX_LABELS: Record<ReadjustmentIndex, string> = {
  igpm: 'IGPM',
  ipca: 'IPCA',
  inpc: 'INPC',
  outro: 'Outro',
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  ativo: 'Ativo',
  encerrado: 'Encerrado',
  cancelado: 'Cancelado',
};

export const AMENDMENT_STATUS_LABELS: Record<AmendmentStatus, string> = {
  em_analise: 'Em análise',
  assinado: 'Assinado',
};

