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

function sumAmountCents(rows: { amount_cents: number }[] | null): number {
  return (rows ?? []).reduce((total, row) => total + row.amount_cents, 0);
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();
  const todayISO = new Date().toISOString().slice(0, 10);

  const [
    { count: activeCount },
    { data: monthlyActiveContracts },
    { count: overduePaymentsCount },
    { data: expiringContracts },
  ] = await Promise.all([
    supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
    supabase
      .from('contracts')
      .select('amount_cents')
      .eq('status', 'ativo')
      .eq('payment_frequency', 'mensal'),
    supabase
      .from('contract_payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pendente')
      .lt('due_date', todayISO),
    supabase
      .from('contracts_expiring')
      .select('id, title, counterparty, contract_type, end_date, days_until_expiration')
      .order('end_date', { ascending: true }),
  ]);

  const cards = [
    <IndicatorCard key="active" title="Contratos ativos" value={String(activeCount ?? 0)} />,
    <IndicatorCard
      key="monthly"
      title="Valor mensal comprometido"
      value={formatCurrencyCents(sumAmountCents(monthlyActiveContracts))}
    />,
    <IndicatorCard key="expiring" title="Vencendo em breve" value={String(expiringContracts?.length ?? 0)} />,
    <IndicatorCard key="overdue" title="Parcelas em atraso" value={String(overduePaymentsCount ?? 0)} />,
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
                      {contract.counterparty} · {CONTRACT_TYPE_LABELS[contract.contract_type]}
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
