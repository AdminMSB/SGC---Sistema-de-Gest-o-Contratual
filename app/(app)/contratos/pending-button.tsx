'use client';

import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from '@/components/ui/button';

/** Botão de envio que mostra um texto de andamento enquanto a Server Action do formulário roda. */
export function PendingButton({
  label,
  pendingLabel,
  variant,
  size,
}: {
  label: string;
  pendingLabel: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
