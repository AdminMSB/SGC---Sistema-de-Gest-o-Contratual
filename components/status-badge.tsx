import { Badge, type BadgeTone } from '@/components/ui/badge';
import {
  CONTRACT_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type ContractStatus,
  type PaymentStatus,
} from '@/types/domain';

const contractTones: Record<ContractStatus, BadgeTone> = {
  ativo: 'success',
  encerrado: 'neutral',
  cancelado: 'destructive',
};

const paymentTones: Record<PaymentStatus, BadgeTone> = {
  pendente: 'warning',
  pago: 'success',
  atrasado: 'destructive',
};

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return <Badge tone={contractTones[status]}>{CONTRACT_STATUS_LABELS[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={paymentTones[status]}>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}
