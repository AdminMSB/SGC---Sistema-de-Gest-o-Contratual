export type Role = 'membro' | 'admin';

export type ContractType = 'fornecedor' | 'aluguel' | 'servico' | 'outro';
export type ContractStatus = 'ativo' | 'encerrado' | 'cancelado';
export type RenewalType = 'automatica' | 'manual' | 'nenhuma';
export type PaymentFrequency = 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'unico' | 'outro';
export type PaymentStatus = 'pendente' | 'pago' | 'atrasado';

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
  fornecedor: 'Fornecedor/prestador de serviço',
  aluguel: 'Locação',
  servico: 'Serviço',
  outro: 'Outro',
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  ativo: 'Ativo',
  encerrado: 'Encerrado',
  cancelado: 'Cancelado',
};

export const RENEWAL_TYPE_LABELS: Record<RenewalType, string> = {
  automatica: 'Renovação automática',
  manual: 'Renovação manual',
  nenhuma: 'Sem renovação',
};

export const PAYMENT_FREQUENCY_LABELS: Record<PaymentFrequency, string> = {
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
  unico: 'Pagamento único',
  outro: 'Outro',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  atrasado: 'Atrasado',
};
