import Link from 'next/link';
import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';
import { requireProfile } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
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

/**
 * Card de destaque, clicável, que leva direto para a lista relevante. Ganha um contorno de
 * alerta quando `value > 0` — é a parte "precisa de ação agora" do dashboard.
 */
function HeroCard({
  href,
  title,
  value,
  description,
}: {
  href: string;
  title: string;
  value: number;
  description: string;
}) {
  const urgent = value > 0;
  return (
    <Link
      href={href}
      className={cn(
        'flex flex-col justify-between rounded-lg border p-5 transition-colors hover:border-primary',
        urgent ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-card',
      )}
    >
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className={cn('mt-2 text-4xl font-semibold', urgent ? 'text-destructive' : 'text-foreground')}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </Link>
  );
}

/** Barra horizontal: cor padrão (primary) para o normal, "critical" só para o bucket vencido. */
function ProgressBar({
  label,
  count,
  total,
  tone = 'default',
}: {
  label: string;
  count: number;
  total: number;
  tone?: 'default' | 'critical';
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{count}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-muted">
        <div
          className={`h-2 rounded-full ${tone === 'critical' ? 'bg-destructive' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Agrupa itens com `daysUntil` em vencidos / até 30 / 31-60 / 61-90 dias. */
function daysUntilBuckets(items: { daysUntil: number }[]): { label: string; count: number; tone?: 'critical' }[] {
  return [
    { label: 'Vencidos', count: items.filter((c) => c.daysUntil < 0).length, tone: 'critical' },
    { label: 'Até 30 dias', count: items.filter((c) => c.daysUntil >= 0 && c.daysUntil <= 30).length },
    { label: '31 a 60 dias', count: items.filter((c) => c.daysUntil > 30 && c.daysUntil <= 60).length },
    { label: '61 a 90 dias', count: items.filter((c) => c.daysUntil > 60 && c.daysUntil <= 90).length },
  ];
}

function daysUntilLabel(daysUntil: number): string {
  if (daysUntil < 0) return `Vencido há ${Math.abs(daysUntil)} dia(s)`;
  if (daysUntil === 0) return 'Hoje';
  return `${daysUntil} dia(s)`;
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  const [{ data: activeContracts }, { count: closedCount }, { count: totalCount }] = await Promise.all([
    supabase
      .from('contracts')
      .select('id, title, contract_type, end_date, internal_manager_id, alert_emails, readjustment_date')
      .eq('status', 'ativo'),
    supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'encerrado'),
    supabase.from('contracts').select('*', { count: 'exact', head: true }),
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
  const expiringWithin30 = withDaysUntil.filter((c) => c.daysUntil >= 0 && c.daysUntil <= 30);

  const periodBuckets = daysUntilBuckets(withDaysUntil);
  const periodTotal = Math.max(...periodBuckets.map((b) => b.count), 1);

  const withReadjustmentDays = contracts
    .filter((c) => c.readjustment_date)
    .map((c) => ({
      ...c,
      daysUntil: differenceInCalendarDays(startOfDay(parseISO(c.readjustment_date!)), today),
    }));
  const readjustmentWithin30 = withReadjustmentDays.filter((c) => c.daysUntil >= 0 && c.daysUntil <= 30);
  const readjustmentSoon = withReadjustmentDays
    .filter((c) => c.daysUntil <= 90)
    .sort((a, b) => a.daysUntil - b.daysUntil);
  const readjustmentBuckets = daysUntilBuckets(withReadjustmentDays);
  const readjustmentTotal = Math.max(...readjustmentBuckets.map((b) => b.count), 1);

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Olá, {profile.fullName}.</p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Precisa de ação
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <HeroCard
            href="#vencendo-em-breve"
            title="A vencer em até 30 dias"
            value={expiringWithin30.length}
            description="Vigência chegando ao fim — avaliar renovação."
          />
          <HeroCard
            href="#reajustes-proximos"
            title="Próximo de reajuste (até 30 dias)"
            value={readjustmentWithin30.length}
            description="Data de reajuste prevista se aproximando."
          />
          <HeroCard
            href="#vencendo-em-breve"
            title="Contratos fora da vigência"
            value={expiredContracts.length}
            description="Ativos no sistema, mas com vigência já encerrada."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <IndicatorCard title="Total de contratos" value={String(totalCount ?? 0)} />
        <IndicatorCard title="Contratos ativos" value={String(contracts.length)} />
        <IndicatorCard title="Contratos encerrados" value={String(closedCount ?? 0)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Vencimentos por período</CardTitle>
            <CardDescription>Contratos ativos, pela data de fim da vigência.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {periodBuckets.map((bucket) => (
              <ProgressBar
                key={bucket.label}
                label={bucket.label}
                count={bucket.count}
                total={periodTotal}
                tone={bucket.tone}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reajustes por período</CardTitle>
            <CardDescription>Contratos ativos com data de reajuste prevista.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {withReadjustmentDays.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum contrato ativo com data de reajuste prevista.</p>
            ) : (
              readjustmentBuckets.map((bucket) => (
                <ProgressBar
                  key={bucket.label}
                  label={bucket.label}
                  count={bucket.count}
                  total={readjustmentTotal}
                  tone={bucket.tone}
                />
              ))
            )}
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

      <Card id="vencendo-em-breve" className="scroll-mt-4">
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
                    <Badge tone={contract.daysUntil < 0 || contract.daysUntil <= 7 ? 'destructive' : 'warning'}>
                      {daysUntilLabel(contract.daysUntil)}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card id="reajustes-proximos" className="scroll-mt-4">
        <CardHeader>
          <CardTitle>Reajustes próximos</CardTitle>
          <CardDescription>Data de reajuste prevista nos próximos 90 dias, ou já vencida.</CardDescription>
        </CardHeader>
        <CardContent>
          {readjustmentSoon.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum reajuste previsto nos próximos 90 dias.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {readjustmentSoon.map((contract) => (
                <li key={contract.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <Link href={`/contratos/${contract.id}`} className="font-medium hover:underline">
                      {contract.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">{CONTRACT_TYPE_LABELS[contract.contract_type]}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{formatDate(contract.readjustment_date!)}</p>
                    <Badge tone={contract.daysUntil < 0 || contract.daysUntil <= 7 ? 'destructive' : 'warning'}>
                      {daysUntilLabel(contract.daysUntil)}
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
          <AttentionGroup title="Sem gestor atribuído" contracts={withoutManager} />
          <AttentionGroup title="Sem e-mail de alerta de vencimento/reajuste" contracts={withoutAlertEmails} />
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
