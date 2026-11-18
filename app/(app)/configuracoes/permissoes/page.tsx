import { createServerSupabaseClient } from '@/lib/supabase/server';
import { PERMISSIONS, PERMISSION_INFO, buildPermissionMap } from '@/lib/permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { savePermissions } from './actions';

export const dynamic = 'force-dynamic';

export default async function PermissoesPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string };
}) {
  const supabase = await createServerSupabaseClient();
  const { data: rows } = await supabase.from('role_permissions').select('permission, allowed').eq('role', 'gestor');
  const gestor = buildPermissionMap(rows ?? []);

  return (
    <div className="flex flex-col gap-6">
      {searchParams.error && <p className="text-sm text-destructive">{searchParams.error}</p>}
      {searchParams.ok && (
        <p className="rounded-md border border-green-600/30 bg-green-600/10 px-4 py-3 text-sm font-medium text-green-700">
          Permissões salvas. Valem a partir da próxima ação de cada usuário.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Permissões por nível</CardTitle>
          <CardDescription>
            O Administrador sempre pode tudo. Marque o que o Gestor pode fazer nos contratos em que é o responsável.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={savePermissions} className="flex flex-col gap-4">
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3 font-medium">Ação</th>
                    <th className="w-28 p-3 text-center font-medium">Gestor</th>
                    <th className="w-28 p-3 text-center font-medium">Administrador</th>
                  </tr>
                </thead>
                <tbody>
                  {PERMISSIONS.map((permission) => (
                    <tr key={permission} className="border-t border-border">
                      <td className="p-3">
                        <p className="font-medium">{PERMISSION_INFO[permission].label}</p>
                        <p className="text-xs text-muted-foreground">{PERMISSION_INFO[permission].description}</p>
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          name={permission}
                          defaultChecked={gestor[permission]}
                          aria-label={`Gestor: ${PERMISSION_INFO[permission].label}`}
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input type="checkbox" checked disabled aria-label="Administrador: sempre permitido" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <Button type="submit">Salvar permissões</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regras fixas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p>
            <strong>Administrador:</strong> vê todos os contratos, exclui contratos, gerencia usuários e permissões e
            acessa Configurações.
          </p>
          <p>
            <strong>Gestor:</strong> vê apenas os contratos em que é o &quot;Gestor do contrato&quot;. Não exclui
            contratos nem acessa Configurações.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
