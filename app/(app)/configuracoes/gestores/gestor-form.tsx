'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addManager } from './actions';

export function AddManagerDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Adicionar gestor
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Adicionar gestor">
        <form action={addManager} className="flex flex-col gap-4" onSubmit={() => setOpen(false)}>
          <div>
            <Label htmlFor="manager-full-name">Nome completo</Label>
            <Input id="manager-full-name" name="full_name" required />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Adicionar</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
