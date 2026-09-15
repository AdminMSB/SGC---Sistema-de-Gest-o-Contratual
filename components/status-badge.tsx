import { Badge, type BadgeTone } from '@/components/ui/badge';
import { CONTRACT_STATUS_LABELS, type ContractStatus } from '@/types/domain';

const contractTones: Record<ContractStatus, BadgeTone> = {
  ativo: 'success',
  encerrado: 'neutral',
  cancelado: 'destructive',
};

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return <Badge tone={contractTones[status]}>{CONTRACT_STATUS_LABELS[status]}</Badge>;
}
