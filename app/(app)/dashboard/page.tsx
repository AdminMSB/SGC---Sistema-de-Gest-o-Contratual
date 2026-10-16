import Link from 'next/link';
import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';
import { requireProfile } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { computeDocumentStatus } from '@/lib/contract-documents';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CONTRACT_TYPE_LABELS, type ContractType } from '@/types/domain';

/** Barra horizontal: cor padrão (primary) para o normal, "critical" só para o estado de alerta. */
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

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  const [{ data: activeContracts }, { data: documents }] = await Promise.all([
    supabase
      .from('contracts')
      .select('id, title, contract_type, end_date, internal_manager_id, alert_emails, readjustment_date')
      .eq('status', 'ativo'),
    supabase.from('contract_documents').select('contract_id, file_path, validity_date'),
  ]);

  const today = startOfDay(new Date());
  const contracts = activeContracts ?? [];

  const withDaysUntil = contracts
    .filter((c) => c.end_date)
    .map((c) => ({ ...c, daysUntil: differenceInCalendarDays(startOfDay(parseISO(c.end_date!)), today) }));
  const periodBuckets = daysUntilBuckets(withDaysUntil);
  const periodTotal = Math.max(...periodBuckets.map((b) => b.count), 1);

  const withReadjustmentDays = contracts
    .filter((c) => c.readjustment_date)
    .map((c) => ({
      ...c,
      daysUntil: differenceInCalendarDays(startOfDay(parseISO(c.readjustment_date!)), today),
    }));
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

  // Documentação de habilitação: cada contrato ativo entra na pior situação entre seus documentos.
  const documentStatusesByContract = new Map<string, string[]>();
  for (const document of documents ?? []) {
    const status = computeDocumentStatus(document.file_path, document.validity_date);
    documentStatusesByContract.set(document.contract_id, [
      ...(documentStatusesByContract.get(document.contract_id) ?? []),
      status,
    ]);
  }
  const withExpiredDocuments = contracts.filter((c) => documentStatusesByContract.get(c.id)?.includes('vencido'));
  const withExpiringDocuments = contracts.filter(
    (c) =>
      !documentStatusesByContract.get(c.id)?.includes('vencido') &&
      documentStatusesByContract.get(c.id)?.includes('vencendo'),
  );
  const withoutDocuments = contracts.filter((c) => !documentStatusesByContract.has(c.id));
  const documentBuckets = [
    { label: 'Com documento vencido', count: withExpiredDocuments.length, tone: 'critical' as const },
    { label: 'Com documento vencendo', count: withExpiringDocuments.length },
    {
      label: 'Documentação em dia',
      count: contracts.length - withExpiredDocuments.length - withExpiringDocuments.length - withoutDocuments.length,
    },
    { label: 'Sem documentos anexados', count: withoutDocuments.length },
  ];
  const documentTotal = Math.max(...documentBuckets.map((b) => b.count), 1);

  const withoutManager = contracts.filter((c) => !c.internal_manager_id);
  const withoutAlertEmails = contracts.filter((c) => !c.alert_emails);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Olá, {profile.fullName}.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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

        <Card>
          <CardHeader>
            <CardTitle>Documentação de habilitação</CardTitle>
            <CardDescription>Contratos ativos, pela situação dos documentos do fornecedor.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {contracts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum contrato ativo.</p>
            ) : (
              documentBuckets.map((bucket) => (
                <ProgressBar
                  key={bucket.label}
                  label={bucket.label}
                  count={bucket.count}
                  total={documentTotal}
                  tone={bucket.tone}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Precisa de atenção</CardTitle>
          <CardDescription>Pendências que podem atrapalhar o acompanhamento do contrato.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <AttentionGroup title="Com documento de habilitação vencido" contracts={withExpiredDocuments} />
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
