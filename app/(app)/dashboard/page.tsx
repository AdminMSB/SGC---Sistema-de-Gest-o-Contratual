import Link from 'next/link';
import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';
import { requireProfile } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatCurrencyCents, formatDate } from '@/lib/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CONTRACT_TYPE_LABELS, type ContractType } from '@/types/domain';

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

function ProgressBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{count}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function sumAmountCents(rows: { total_amount_cents: number | null }[] | null): number {
  return (rows ?? []).reduce((total, row) => total + (row.total_amount_cents ?? 0), 0);
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  const [{ data: activeContracts }, { count: distratoCount }] = await Promise.all([
    supabase
      .from('contracts')
      .select('id, title, contract_type, end_date, total_amount_cents, internal_manager_id, alert_emails')
      .eq('status', 'ativo'),
    supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('has_distrato', true),
  ]);

  const today = startOfDay(new Date());
  const contracts = activeContracts ?? [];

  const withDaysUntil = contracts
    .filter((c) => c.end_date)
    .map((c) => ({ ...c, daysUntil: differenceInCalendarDays(startOfDay(parseISO(c.end_date!)), today) }));

  const expiredContracts = withDaysUntil.filter((c) => c.daysUntil < 0);
  const expiringSoon = withDaysUntil
    .filter((c) => c.daysUntil >= 0 && c.daysUntil <= 90)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const periodBuckets = [
    { label: 'Vencidos', count: expiredContracts.length },
    { label: 'Até 30 dias', count: withDaysUntil.filter((c) => c.daysUntil >= 0 && c.daysUntil <= 30).length },
    { label: '31 a 60 dias', count: withDaysUntil.filter((c) => c.daysUntil > 30 && c.daysUntil <= 60).length },
    { label: '61 a 90 dias', count: withDaysUntil.filter((c) => c.daysUntil > 60 && c.daysUntil <= 90).length },
  ];
  const periodTotal = Math.max(...periodBuckets.map((b) => b.count), 1);

  const categoryBuckets = (Object.keys(CONTRACT_TYPE_LABELS) as ContractType[])
    .map((type) => ({
      label: CONTRACT_TYPE_LABELS[type],
      count: contracts.filter((c) => c.contract_type === type).length,
    }))
    .filter((bucket) => bucket.count > 0)
    .sort((a, b) => b.count - a.count);
  const categoryTotal = Math.max(...categoryBuckets.map((b) => b.count), 1);

  const withoutManager = contracts.filter((c) => !c.internal_manager_id);
  const withoutAlertEmails = contracts.filter((c) => !c.alert_emails);

  const cards = [
    <IndicatorCard key="active" title="Contratos ativos" value={String(contracts.length)} />,
    <IndicatorCard
      key="total-value"
      title="Valor total dos contratos ativos"
      value={formatCurrencyCents(sumAmountCents(contracts))}
    />,
    <IndicatorCard key="expiring" title="Vencendo em até 90 dias" value={String(expiringSoon.length)} />,
    <IndicatorCard key="expired" title="Vencidos, ainda ativos" value={String(expiredContracts.length)} />,
    <IndicatorCard key="distrato" title="Contratos com distrato" value={String(distratoCount ?? 0)} />,
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Olá, {profile.fullName}.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">{cards}</div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vencimentos por período</CardTitle>
            <CardDescription>Contratos ativos, pela data de fim da vigência.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {periodBuckets.map((bucket) => (
              <ProgressBar key={bucket.label} label={bucket.label} count={bucket.count} total={periodTotal} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contratos por categoria</CardTitle>
            <CardDescription>Distribuição dos contratos ativos.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {categoryBuckets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum contrato ativo.</p>
            ) : (
              categoryBuckets.map((bucket) => (
                <ProgressBar key={bucket.label} label={bucket.label} count={bucket.count} total={categoryTotal} />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contratos vencendo em breve</CardTitle>
          <CardDescription>Fim da vigência nos próximos 90 dias, ou já vencidos.</CardDescription>
        </CardHeader>
        <CardContent>
          {expiringSoon.length === 0 && expiredContracts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum contrato vencendo nos próximos 90 dias.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {[...expiredContracts, ...expiringSoon].map((contract) => (
                <li key={contract.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <Link href={`/contratos/${contract.id}`} className="font-medium hover:underline">
                      {contract.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">{CONTRACT_TYPE_LABELS[contract.contract_type]}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{formatDate(contract.end_date!)}</p>
                    <Badge tone={contract.daysUntil < 0 ? 'destructive' : contract.daysUntil <= 7 ? 'destructive' : 'warning'}>
                      {contract.daysUntil < 0
                        ? `Vencido há ${Math.abs(contract.daysUntil)} dia(s)`
                        : contract.daysUntil === 0
                          ? 'Vence hoje'
                          : `${contract.daysUntil} dia(s)`}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Precisa de atenção</CardTitle>
          <CardDescription>Lacunas de cadastro que podem atrapalhar o acompanhamento do contrato.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <AttentionGroup
            title="Sem gestor atribuído"
            contracts={withoutManager}
          />
          <AttentionGroup
            title="Sem e-mail de alerta de vencimento/reajuste"
            contracts={withoutAlertEmails}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function AttentionGroup({
  title,
  contracts,
}: {
  title: string;
  contracts: { id: string; title: string }[];
}) {
  return (
    <div>
      <p className="text-sm font-medium">
        {title} <span className="text-muted-foreground">({contracts.length})</span>
      </p>
      {contracts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum contrato ativo nessa situação.</p>
      ) : (
        <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {contracts.map((contract, index) => (
            <li key={contract.id}>
              <Link href={`/contratos/${contract.id}`} className="text-primary hover:underline">
                {contract.title}
              </Link>
              {index < contracts.length - 1 ? ',' : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
