'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { DEPARTMENT_LABELS, ROLE_LABELS, type Role } from '@/types/domain';
import { inviteUser, updateUser } from './actions';

const ROLE_ENTRIES = Object.entries(ROLE_LABELS) as [Role, string][];
const DEPARTMENT_ENTRIES = Object.entries(DEPARTMENT_LABELS);

function DepartmentSelect({ id, defaultValue }: { id: string; defaultValue: string }) {
  return (
    <Select id={id} name="department" defaultValue={defaultValue}>
      <option value="">—</option>
      {DEPARTMENT_ENTRIES.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </Select>
  );
}

export function InviteUserDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Convidar usuário
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Convidar usuário">
        <form action={inviteUser} className="flex flex-col gap-4" onSubmit={() => setOpen(false)}>
          <div>
            <Label htmlFor="invite-full-name">Nome completo</Label>
            <Input id="invite-full-name" name="full_name" required />
          </div>

          <div>
            <Label htmlFor="invite-email">E-mail</Label>
            <Input id="invite-email" name="email" type="email" required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="invite-job-title">Cargo/função</Label>
              <Input id="invite-job-title" name="job_title" />
            </div>
            <div>
              <Label htmlFor="invite-department">Departamento</Label>
              <DepartmentSelect id="invite-department" defaultValue="" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="invite-phone">Telefone</Label>
              <Input id="invite-phone" name="phone" type="tel" />
            </div>
            <div>
              <Label htmlFor="invite-role">Papel</Label>
              <Select id="invite-role" name="role" defaultValue="gestor" required>
                {ROLE_ENTRIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Enviar convite</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

interface UserRow {
  id: string;
  full_name: string;
  role: Role;
  job_title: string | null;
  department: string | null;
  phone: string | null;
  active: boolean;
}

export function EditUserDialog({ user, isSelf }: { user: UserRow; isSelf: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Editar
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title={`Editar ${user.full_name}`}>
        <form action={updateUser} className="flex flex-col gap-4" onSubmit={() => setOpen(false)}>
          <input type="hidden" name="user_id" value={user.id} />

          <div>
            <Label htmlFor={`name-${user.id}`}>Nome completo</Label>
            <Input id={`name-${user.id}`} name="full_name" defaultValue={user.full_name} required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={`job-${user.id}`}>Cargo/função</Label>
              <Input id={`job-${user.id}`} name="job_title" defaultValue={user.job_title ?? ''} />
            </div>
            <div>
              <Label htmlFor={`dep-${user.id}`}>Departamento</Label>
              <DepartmentSelect id={`dep-${user.id}`} defaultValue={user.department ?? ''} />
            </div>
          </div>

          <div>
            <Label htmlFor={`phone-${user.id}`}>Telefone</Label>
            <Input id={`phone-${user.id}`} name="phone" type="tel" defaultValue={user.phone ?? ''} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={`role-${user.id}`}>Papel</Label>
              <Select id={`role-${user.id}`} name="role" defaultValue={user.role} required>
                {ROLE_ENTRIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`active-${user.id}`}>Situação</Label>
              <Select id={`active-${user.id}`} name="active" defaultValue={String(user.active)} disabled={isSelf}>
                <option value="true">Ativo</option>
                <option value="false">Inativo (sem acesso ao sistema)</option>
              </Select>
              {isSelf && <input type="hidden" name="active" value="true" />}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
