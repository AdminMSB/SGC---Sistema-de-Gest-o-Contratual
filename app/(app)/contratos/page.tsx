import { requireProfile } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContratoForm } from './contrato-form';
import { ContratosTable } from './contratos-table';

export default async function ContratosPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const profile = await requireProfile();
  const isAdmin = profile.role === 'admin';
  const supabase = await createServerSupabaseClient();

  const [{ data: contracts }, { data: managers }] = await Promise.all([
    supabase
      .from('contracts')
      .select('id, title, contract_type, contract_detail_type, status, end_date, total_amount_cents, is_variable_value')
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name').eq('role', 'gestor').eq('active', true).order('full_name'),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Contratos</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? 'Fornecedores/prestadores de serviço, locação e demais contratos da empresa.'
              : 'Contratos em que você é o gestor responsável.'}
          </p>
        </div>
        {profile.permissions.create_edit_contract && (
          <ContratoForm
            mode="create"
            managers={isAdmin ? (managers ?? []) : [{ id: profile.id, full_name: profile.fullName }]}
            lockedManagerId={isAdmin ? undefined : profile.id}
          />
        )}
      </div>

      {searchParams.error && <p className="text-sm text-destructive">{searchParams.error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Todos os contratos</CardTitle>
        </CardHeader>
        <CardContent>
          <ContratosTable rows={contracts ?? []} isAdmin={isAdmin} />
        </CardContent>
      </Card>
    </div>
  );
}
