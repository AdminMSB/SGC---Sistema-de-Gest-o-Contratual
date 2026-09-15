import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatCurrencyCents, formatDate } from '@/lib/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CONTRACT_TYPE_LABELS } from '@/types/domain';

function IndicatorCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent />
    </Card>
  );
}

function sumAmountCents(rows: { total_amount_cents: number }[] | null): number {
  return (rows ?? []).reduce((total, row) => total + row.total_amount_cents, 0);
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  const [
    { count: activeCount },
    { data: activeContracts },
    { count: distratoCount },
    { data: expiringContracts },
  ] = await Promise.all([
    supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
    supabase.from('contracts').select('total_amount_cents').eq('status', 'ativo'),
    supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('has_distrato', true),
    supabase
      .from('contracts_expiring')
      .select('id, title, contract_type, end_date, days_until_expiration')
      .order('end_date', { ascending: true }),
  ]);

  const cards = [
    <IndicatorCard key="active" title="Contratos ativos" value={String(activeCount ?? 0)} />,
    <IndicatorCard
      key="total-value"
      title="Valor total dos contratos ativos"
      value={formatCurrencyCents(sumAmountCents(activeContracts))}
    />,
    <IndicatorCard key="expiring" title="Vencendo em breve" value={String(expiringContracts?.length ?? 0)} />,
    <IndicatorCard key="distrato" title="Contratos com distrato" value={String(distratoCount ?? 0)} />,
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Olá, {profile.fullName}.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards}</div>

      <Card>
        <CardHeader>
          <CardTitle>Contratos vencendo em breve</CardTitle>
          <CardDescription>
            Dentro do prazo de aviso configurado em cada contrato (renovação/vencimento da vigência).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(expiringContracts ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum contrato vencendo dentro do prazo de aviso.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {(expiringContracts ?? []).map((contract) => (
                <li key={contract.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <Link href={`/contratos/${contract.id}`} className="font-medium hover:underline">
                      {contract.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {CONTRACT_TYPE_LABELS[contract.contract_type]}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{contract.end_date ? formatDate(contract.end_date) : '—'}</p>
                    <Badge tone={contract.days_until_expiration <= 7 ? 'destructive' : 'warning'}>
                      {contract.days_until_expiration <= 0
                        ? 'Vence hoje'
                        : `${contract.days_until_expiration} dia(s)`}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
