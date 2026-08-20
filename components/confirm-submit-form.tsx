'use client';

import type { ReactNode } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';

interface ConfirmSubmitFormProps {
  action: (formData: FormData) => void;
  confirmMessage: string;
  buttonLabel: string;
  buttonVariant?: ButtonProps['variant'];
  buttonSize?: ButtonProps['size'];
  children: ReactNode;
}

/** Form com confirmação via `window.confirm` antes de disparar uma Server Action destrutiva. */
export function ConfirmSubmitForm({
  action,
  confirmMessage,
  buttonLabel,
  buttonVariant = 'destructive',
  buttonSize,
  children,
}: ConfirmSubmitFormProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      {children}
      <Button type="submit" variant={buttonVariant} size={buttonSize}>
        {buttonLabel}
      </Button>
    </form>
  );
}
