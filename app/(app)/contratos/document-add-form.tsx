'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  CONTRACT_DOCUMENT_TYPES,
  CONTRACT_DOCUMENT_TYPE_LABELS,
  documentTypeHasValidity,
  type ContractDocumentType,
} from '@/lib/contract-documents';
import { upsertContractDocument } from './actions';

/** Anexa um documento escolhendo o tipo na lista; só pede validade para os tipos que têm. */
export function DocumentAddForm({ contractId }: { contractId: string }) {
  const [type, setType] = useState<ContractDocumentType>('cartao_cnpj');

  return (
    <form action={upsertContractDocument} className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
      <input type="hidden" name="contractId" value={contractId} />
      <div>
        <Label htmlFor="doc-type" className="text-xs">
          Documento
        </Label>
        <Select
          id="doc-type"
          name="documentType"
          value={type}
          onChange={(event) => setType(event.target.value as ContractDocumentType)}
          className="w-72"
        >
          {CONTRACT_DOCUMENT_TYPES.map((value) => (
            <option key={value} value={value}>
              {CONTRACT_DOCUMENT_TYPE_LABELS[value]}
            </option>
          ))}
          <option value="outro">Outro documento</option>
        </Select>
      </div>
      {type === 'outro' && (
        <div>
          <Label htmlFor="doc-label" className="text-xs">
            Nome do documento
          </Label>
          <Input id="doc-label" name="label" type="text" placeholder="Ex.: Licença ambiental" required />
        </div>
      )}
      {documentTypeHasValidity(type) && (
        <div>
          <Label htmlFor="doc-validity" className="text-xs">
            Validade{type === 'outro' ? ' (opcional)' : ''}
          </Label>
          <Input id="doc-validity" name="validityDate" type="date" className="w-40" />
        </div>
      )}
      <div>
        <Label htmlFor="doc-file" className="text-xs">
          Arquivo (PDF)
        </Label>
        <Input id="doc-file" name="file" type="file" accept="application/pdf" required />
      </div>
      <Button type="submit" variant="secondary" size="sm" className="mb-1">
        Anexar
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        Anexar de novo um documento já cadastrado substitui o arquivo e a validade anteriores.
      </p>
    </form>
  );
}
