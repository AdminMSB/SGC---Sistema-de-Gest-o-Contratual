'use client';

import { useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signDocument } from './actions';

const DATE_FORMAT = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' });
const TIME_FORMAT = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', timeStyle: 'medium' });

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Registrando assinatura…' : 'Confirmar assinatura'}
    </Button>
  );
}

/** Formulário de assinatura com uma etapa de confirmação mostrando data e hora antes de registrar. */
export function SignForm({
  token,
  documentTitle,
  roleLabel,
}: {
  token: string;
  documentTitle: string;
  roleLabel: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  // A hora só é definida ao abrir a confirmação (evita divergência entre servidor e navegador).
  const [now, setNow] = useState<Date | null>(null);

  function askConfirmation() {
    if (!formRef.current?.reportValidity()) return;
    setNow(new Date());
    setOpen(true);
  }

  return (
    <form ref={formRef} action={signDocument} className="flex max-w-lg flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <Label htmlFor="signedName">Digite seu nome completo</Label>
        <Input
          id="signedName"
          name="signedName"
          required
          minLength={3}
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="accept" required className="mt-0.5" />
        <span>Li o documento e concordo com o seu conteúdo. Declaro que esta é a minha assinatura.</span>
      </label>
      <div>
        <Button type="button" onClick={askConfirmation}>
          Assinar documento
        </Button>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title="Confirmar assinatura">
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            Confirmar a assinatura do documento <strong>{documentTitle}</strong>
            {roleLabel ? (
              <>
                {' '}
                como <strong>{roleLabel}</strong>
              </>
            ) : null}{' '}
            em nome de <strong>{name.trim()}</strong>, na data <strong>{now ? DATE_FORMAT.format(now) : ''}</strong>,
            às <strong>{now ? TIME_FORMAT.format(now) : ''}</strong> (horário de Brasília)?
          </p>
          <p className="text-xs text-muted-foreground">
            O registro oficial usa o horário exato do envio, com seu IP e a identificação (hash) do documento.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Voltar
            </Button>
            <ConfirmButton />
          </div>
        </div>
      </Dialog>
    </form>
  );
}
