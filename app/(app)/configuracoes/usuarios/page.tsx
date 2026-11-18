import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { DEPARTMENT_LABELS, ROLE_LABELS, type Department, type Role } from '@/types/domain';
import { InviteUserDialog, EditUserDialog } from './usuarios-form';

const ROLE_TONES: Record<Role, BadgeTone> = {
  gestor: 'warning',
  admin: 'success',
};

const LAST_ACCESS_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const current = await requireRole('admin');

  const supabase = await createServerSupabaseClient();
  const admin = createAdminSupabaseClient();

  const [{ data: profiles }, { data: usersPage }] = await Promise.all([
    supabase.from('profiles').select('*').order('full_name'),
    admin.auth.admin.listUsers({ perPage: 200 }),
  ]);

  const profileList = profiles ?? [];
  const authById = new Map((usersPage?.users ?? []).map((user) => [user.id, user]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Usuários</h1>
          <p className="text-sm text-muted-foreground">
            Cadastro de usuários e papéis (Gestor e Administrador). Usuários inativos não conseguem entrar.
          </p>
        </div>
        <InviteUserDialog />
      </div>

      {searchParams.error && <p className="text-sm text-destructive">{searchParams.error}</p>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Último acesso</TableHead>
                <TableHead className="w-0">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profileList.map((profile) => {
                const authUser = authById.get(profile.id);
                const active = profile.active ?? true;
                return (
                  <TableRow key={profile.id}>
                    <TableCell>
                      <p className="font-medium">{profile.full_name}</p>
                      {profile.job_title && <p className="text-xs text-muted-foreground">{profile.job_title}</p>}
                    </TableCell>
                    <TableCell>{authUser?.email ?? '—'}</TableCell>
                    <TableCell>
                      {profile.department
                        ? (DEPARTMENT_LABELS[profile.department as Department] ?? profile.department)
                        : '—'}
                    </TableCell>
                    <TableCell>{profile.phone ?? '—'}</TableCell>
                    <TableCell>
                      <Badge tone={ROLE_TONES[profile.role]}>{ROLE_LABELS[profile.role]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge tone={active ? 'success' : 'neutral'}>{active ? 'Ativo' : 'Inativo'}</Badge>
                    </TableCell>
                    <TableCell>
                      {authUser?.last_sign_in_at
                        ? LAST_ACCESS_FORMAT.format(new Date(authUser.last_sign_in_at))
                        : 'Nunca acessou'}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <EditUserDialog user={{ ...profile, active }} isSelf={profile.id === current.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {profileList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Nenhum usuário cadastrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
