'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';

/** Botão de envio com feedback: a geração do PDF final pode levar alguns segundos. */
export function SignButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Registrando assinatura…' : 'Assinar documento'}
    </Button>
  );
}
