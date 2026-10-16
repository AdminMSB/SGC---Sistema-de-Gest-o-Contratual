'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MAX_SIGNERS } from '@/lib/signature-limits';
import { createSignatureRequest } from './signature-actions';

/** Lista de signatários (nome + e-mail) para disparar a assinatura eletrônica do PDF do contrato. */
export function SignatureRequestForm({ contractId }: { contractId: string }) {
  const [rows, setRows] = useState([0]);
  const [nextKey, setNextKey] = useState(1);

  return (
    <form action={createSignatureRequest} className="flex flex-col gap-3">
      <input type="hidden" name="contractId" value={contractId} />
      {rows.map((key, index) => (
        <div key={key} className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor={`signer-name-${key}`} className="text-xs">
              Nome
            </Label>
            <Input id={`signer-name-${key}`} name="signerName" className="w-64" required />
          </div>
          <div>
            <Label htmlFor={`signer-email-${key}`} className="text-xs">
              E-mail
            </Label>
            <Input id={`signer-email-${key}`} name="signerEmail" type="email" className="w-72" required />
          </div>
          {rows.length > 1 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setRows(rows.filter((row) => row !== key))}
              aria-label={`Remover signatário ${index + 1}`}
            >
              Remover
            </Button>
          )}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {rows.length < MAX_SIGNERS && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setRows([...rows, nextKey]);
              setNextKey(nextKey + 1);
            }}
          >
            + Adicionar signatário
          </Button>
        )}
        <Button type="submit" size="sm">
          Enviar para assinatura
        </Button>
      </div>
    </form>
  );
}
