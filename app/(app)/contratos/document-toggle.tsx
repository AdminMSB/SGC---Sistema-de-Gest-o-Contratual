'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

/** Mostra um PDF na própria página sob demanda (só carrega o arquivo quando a pessoa abre). */
export function DocumentToggle({ src, label }: { src: string; label: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(!open)}>
          {open ? 'Ocultar documento' : label}
        </Button>
        <a href={src} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
          Abrir em nova aba
        </a>
      </div>
      {open && (
        <iframe
          src={src}
          title="Documento com assinaturas (PDF)"
          className="h-[700px] w-full rounded-md border border-border"
        />
      )}
    </div>
  );
}
