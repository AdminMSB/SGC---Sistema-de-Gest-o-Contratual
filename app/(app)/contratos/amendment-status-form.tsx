'use client';

import { Select } from '@/components/ui/select';
import { AMENDMENT_STATUS_LABELS, type AmendmentStatus } from '@/types/domain';
import { updateAmendmentStatus } from './actions';

const AMENDMENT_STATUS_ENTRIES = Object.entries(AMENDMENT_STATUS_LABELS) as [AmendmentStatus, string][];

/** Select que salva sozinho ao trocar de valor — evita precisar de um botão "Salvar" à parte. */
export function AmendmentStatusForm({
  amendmentId,
  contractId,
  status,
}: {
  amendmentId: string;
  contractId: string;
  status: AmendmentStatus;
}) {
  return (
    <form action={updateAmendmentStatus}>
      <input type="hidden" name="amendmentId" value={amendmentId} />
      <input type="hidden" name="contractId" value={contractId} />
      <Select
        name="status"
        defaultValue={status}
        className="h-8 w-auto text-xs"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {AMENDMENT_STATUS_ENTRIES.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
    </form>
  );
}
