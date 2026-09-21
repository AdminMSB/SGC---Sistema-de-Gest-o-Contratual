import { Badge, type BadgeTone } from '@/components/ui/badge';
import { CONTRACT_DISPLAY_STATUS_LABELS, type ContractDisplayStatus } from '@/types/domain';

const contractTones: Record<ContractDisplayStatus, BadgeTone> = {
  ativo: 'success',
  expirado: 'warning',
  encerrado: 'neutral',
};

export function ContractStatusBadge({ status }: { status: ContractDisplayStatus }) {
  return <Badge tone={contractTones[status]}>{CONTRACT_DISPLAY_STATUS_LABELS[status]}</Badge>;
}
