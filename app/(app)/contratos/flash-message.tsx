'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/** Mensagem de retorno de uma ação; rola a tela até ela, já que o botão costuma estar longe do topo. */
export function FlashMessage({ tone, message }: { tone: 'success' | 'error'; message: string }) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [message]);

  return (
    <p
      ref={ref}
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-md border px-4 py-3 text-sm font-medium',
        tone === 'success'
          ? 'border-green-600/30 bg-green-600/10 text-green-700'
          : 'border-destructive/30 bg-destructive/10 text-destructive',
      )}
    >
      {message}
    </p>
  );
}
