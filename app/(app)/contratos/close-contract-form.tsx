'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { CLOSURE_REASON_LABELS, type ClosureReason } from '@/types/domain';
import { updateContractStatus } from './actions';

const CLOSURE_REASON_ENTRIES = Object.entries(CLOSURE_REASON_LABELS) as [ClosureReason, string][];

/** Botão "Marcar como encerrado" que abre uma escolha de motivo antes de enviar. */
export function CloseContractForm({ contractId }: { contractId: string }) {
  const [choosingReason, setChoosingReason] = useState(false);

  if (!choosingReason) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setChoosingReason(true)}>
        Marcar como encerrado
      </Button>
    );
  }

  return (
    <form action={updateContractStatus} className="flex items-center gap-2">
      <input type="hidden" name="id" value={contractId} />
      <input type="hidden" name="status" value="encerrado" />
      <Select name="closureReason" defaultValue="encerrado" className="h-8 w-auto text-xs" required>
        {CLOSURE_REASON_ENTRIES.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <Button type="submit" variant="secondary" size="sm">
        Confirmar
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setChoosingReason(false)}>
        Cancelar
      </Button>
    </form>
  );
}
