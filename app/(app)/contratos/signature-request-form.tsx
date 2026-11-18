'use client';

import { useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  MAX_SIGNERS,
  SIGNER_ROLES,
  SIGNER_ROLE_LABELS,
  signerRoleLabel,
  signerStep,
  signingRank,
} from '@/lib/signature-limits';
import { createSignatureRequest } from './signature-actions';

const DATE_FORMAT = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' });
const TIME_FORMAT = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', timeStyle: 'medium' });

const ROLE_ORDER_HINT = SIGNER_ROLES.map((role) => SIGNER_ROLE_LABELS[role]).join(' → ');

function ConfirmSendButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Enviando…' : 'Confirmar envio'}
    </Button>
  );
}

interface Summary {
  name: string;
  email: string;
  role: string;
}

/** Lista de signatários (papel, nome, e-mail) para disparar a assinatura eletrônica do PDF do contrato. */
export function SignatureRequestForm({ contractId }: { contractId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [rows, setRows] = useState([0]);
  const [nextKey, setNextKey] = useState(1);
  const [open, setOpen] = useState(false);
  // A hora só é definida ao abrir a confirmação (evita divergência entre servidor e navegador).
  const [now, setNow] = useState<Date | null>(null);
  const [summary, setSummary] = useState<Summary[]>([]);

  function askConfirmation() {
    const form = formRef.current;
    if (!form || !form.reportValidity()) return;
    const data = new FormData(form);
    const names = data.getAll('signerName').map(String);
    const emails = data.getAll('signerEmail').map(String);
    const roles = data.getAll('signerRole').map(String);
    setSummary(
      names
        .map((name, index) => ({ name: name.trim(), email: (emails[index] ?? '').trim(), role: roles[index] ?? '' }))
        .sort((a, b) => signerStep(a.role) - signerStep(b.role)),
    );
    setNow(new Date());
    setOpen(true);
  }

  return (
    <form ref={formRef} action={createSignatureRequest} className="flex flex-col gap-3">
      <input type="hidden" name="contractId" value={contractId} />
      <p className="text-xs text-muted-foreground">
        A assinatura segue a ordem dos papéis: {ROLE_ORDER_HINT}. Cada pessoa só recebe o link quando as etapas
        anteriores terminam; quem tem o mesmo papel assina ao mesmo tempo.
      </p>
      {rows.map((key, index) => (
        <div key={key} className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor={`signer-role-${key}`} className="text-xs">
              Papel
            </Label>
            <Select id={`signer-role-${key}`} name="signerRole" defaultValue="contratante" className="w-48">
              {SIGNER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {SIGNER_ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
          </div>
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
        <Button type="button" size="sm" onClick={askConfirmation}>
          Enviar para assinatura
        </Button>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title="Confirmar envio para assinatura">
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            Enviar o documento para assinatura em <strong>{now ? DATE_FORMAT.format(now) : ''}</strong>, às{' '}
            <strong>{now ? TIME_FORMAT.format(now) : ''}</strong> (horário de Brasília), seguindo esta ordem:
          </p>
          <ol className="flex flex-col gap-1 text-sm">
            {summary.map((signer, index) => (
              <li key={`${signer.email}-${index}`}>
                <span className="text-muted-foreground">
                  {signingRank(
                    summary.map((item) => item.role),
                    signer.role,
                  )}
                  ª etapa —{' '}
                </span>
                <strong>{signer.name}</strong> ({signerRoleLabel(signer.role) ?? 'Sem papel'}) — {signer.email}
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            O link vai por e-mail só para a primeira etapa agora; as demais recebem quando chegar a vez.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Voltar
            </Button>
            <ConfirmSendButton />
          </div>
        </div>
      </Dialog>
    </form>
  );
}
