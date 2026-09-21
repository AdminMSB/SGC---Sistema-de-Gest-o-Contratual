export type Role = 'membro' | 'gestor' | 'admin';

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
export type ContractStatus = 'ativo' | 'encerrado';
/** "expirado" não é um valor salvo no banco — é calculado a partir do fim da vigência. */
export type ContractDisplayStatus = ContractStatus | 'expirado';
export type Department =
  | 'administrativo'
  | 'manutencao'
  | 'garantia_qualidade'
  | 'controle_qualidade'
  | 'comercial_vendas'
  | 'marketing'
  | 'contabilidade'
  | 'financeiro'
  | 'producao'
  | 'projetos_ti'
  | 'engenharia'
  | 'diretoria_executiva'
  | 'juridico';
export type ReadjustmentIndex = 'igpm' | 'ipca' | 'inpc' | 'outro';
export type AmendmentStatus = 'em_analise' | 'assinado';

export interface CurrentProfile {
  id: string;
  fullName: string;
  role: Role;
}

export const ROLE_LABELS: Record<Role, string> = {
  membro: 'Membro',
  gestor: 'Gestor',
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
};

export const CONTRACT_DISPLAY_STATUS_LABELS: Record<ContractDisplayStatus, string> = {
  ativo: 'Ativo',
  expirado: 'Expirado',
  encerrado: 'Encerrado',
};

export const AMENDMENT_STATUS_LABELS: Record<AmendmentStatus, string> = {
  em_analise: 'Em análise',
  assinado: 'Concluído',
};

export const DEPARTMENT_LABELS: Record<Department, string> = {
  administrativo: 'Administrativo',
  manutencao: 'Manutenção',
  garantia_qualidade: 'Garantia da qualidade',
  controle_qualidade: 'Controle de qualidade',
  comercial_vendas: 'Comercial/Vendas',
  marketing: 'Marketing',
  contabilidade: 'Contabilidade',
  financeiro: 'Financeiro',
  producao: 'Produção',
  projetos_ti: 'Projetos e TI',
  engenharia: 'Engenharia',
  diretoria_executiva: 'Diretoria executiva',
  juridico: 'Jurídico',
};

