import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { ConfirmSubmitForm } from '@/components/confirm-submit-form';
import { AddManagerDialog } from './gestor-form';
import { deleteManager } from './actions';

export default async function GestoresPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  await requireRole('admin');

  const supabase = await createServerSupabaseClient();
  const { data: managers } = await supabase.from('contract_managers').select('id, full_name').order('full_name');
  const managerList = managers ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Gestores</h1>
          <p className="text-sm text-muted-foreground">
            Lista de gestores de contrato disponível no cadastro/edição de contratos.
          </p>
        </div>
        <AddManagerDialog />
      </div>

      {searchParams.error && <p className="text-sm text-destructive">{searchParams.error}</p>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="w-0">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {managerList.map((manager) => (
                <TableRow key={manager.id}>
                  <TableCell>{manager.full_name}</TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <ConfirmSubmitForm
                        action={deleteManager}
                        confirmMessage={`Excluir "${manager.full_name}" da lista de gestores?`}
                        buttonLabel="Excluir"
                        buttonSize="sm"
                      >
                        <input type="hidden" name="id" value={manager.id} />
                      </ConfirmSubmitForm>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {managerList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    Nenhum gestor cadastrado.
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
