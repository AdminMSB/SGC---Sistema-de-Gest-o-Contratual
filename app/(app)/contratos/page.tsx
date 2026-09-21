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
  const supabase = await createServerSupabaseClient();

  const [{ data: contracts }, { data: managers }] = await Promise.all([
    supabase
      .from('contracts')
      .select('id, title, contract_type, status, end_date, total_amount_cents, is_variable_value')
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name').eq('role', 'gestor').order('full_name'),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Contratos</h1>
          <p className="text-sm text-muted-foreground">
            Fornecedores/prestadores de serviço, locação e demais contratos da empresa.
          </p>
        </div>
        <ContratoForm mode="create" managers={managers ?? []} />
      </div>

      {searchParams.error && <p className="text-sm text-destructive">{searchParams.error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Todos os contratos</CardTitle>
        </CardHeader>
        <CardContent>
          <ContratosTable rows={contracts ?? []} isAdmin={profile.role === 'admin'} />
        </CardContent>
      </Card>
    </div>
  );
}
