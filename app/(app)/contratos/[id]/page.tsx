import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatCurrencyCents, formatDate } from '@/lib/format';
import { paymentEffectiveStatus } from '@/lib/contracts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ContractStatusBadge, PaymentStatusBadge } from '@/components/status-badge';
import { ConfirmSubmitForm } from '@/components/confirm-submit-form';
import {
  CONTRACT_TYPE_LABELS,
  PAYMENT_FREQUENCY_LABELS,
  RENEWAL_TYPE_LABELS,
} from '@/types/domain';
import { ContratoForm } from '../contrato-form';
import {
  addPayment,
  deleteContract,
  deletePayment,
  markPaymentPaid,
  reopenPayment,
  updateContractStatus,
} from '../actions';

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2 last:border-0 sm:flex-row sm:items-baseline sm:justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium sm:text-right">{value}</span>
    </div>
  );
}

export default async function ContratoDetalhePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  const { data: contract } = await supabase.from('contracts').select('*').eq('id', params.id).single();
  if (!contract) notFound();

  const { data: payments } = await supabase
    .from('contract_payments')
    .select('*')
    .eq('contract_id', contract.id)
    .order('due_date', { ascending: true });

  let fileUrl: string | null = null;
  if (contract.file_path) {
    const { data: signed } = await supabase.storage.from('contracts').createSignedUrl(contract.file_path, 300);
    fileUrl = signed?.signedUrl ?? null;
  }

  const totalPaidCents = (payments ?? [])
    .filter((payment) => payment.status === 'pago')
    .reduce((sum, payment) => sum + (payment.paid_amount_cents ?? payment.amount_cents), 0);
  const totalPendingCents = (payments ?? [])
    .filter((payment) => payment.status === 'pendente')
    .reduce((sum, payment) => sum + payment.amount_cents, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/contratos" className="text-sm text-muted-foreground hover:underline">
          ← Voltar para contratos
        </Link>
      </div>

      {searchParams.error && <p className="text-sm text-destructive">{searchParams.error}</p>}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{contract.title}</h1>
          <p className="text-sm text-muted-foreground">{contract.counterparty}</p>
        </div>
        <div className="flex items-center gap-2">
          <ContratoForm mode="edit" contract={contract} triggerVariant="secondary" />
          {profile.role === 'admin' && (
            <ConfirmSubmitForm
              action={deleteContract}
              confirmMessage="Excluir este contrato e todo o histórico de pagamentos? Esta ação não pode ser desfeita."
              buttonLabel="Excluir"
            >
              <input type="hidden" name="id" value={contract.id} />
            </ConfirmSubmitForm>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Dados do contrato</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col">
              <DetailRow label="Tipo" value={CONTRACT_TYPE_LABELS[contract.contract_type]} />
              <DetailRow label="Status" value={<ContractStatusBadge status={contract.status} />} />
              <DetailRow label="Início da vigência" value={formatDate(contract.start_date)} />
              <DetailRow
                label="Fim da vigência"
                value={contract.end_date ? formatDate(contract.end_date) : 'Indeterminado'}
              />
              <DetailRow label="Renovação" value={RENEWAL_TYPE_LABELS[contract.renewal_type]} />
              <DetailRow label="Aviso de vencimento" value={`${contract.renewal_notice_days} dia(s) de antecedência`} />
              <DetailRow label="Frequência de pagamento" value={PAYMENT_FREQUENCY_LABELS[contract.payment_frequency]} />
              <DetailRow label="Valor da parcela" value={formatCurrencyCents(contract.amount_cents)} />
              {contract.notes && <DetailRow label="Observações" value={contract.notes} />}
              <DetailRow
                label="Arquivo do contrato"
                value={
                  fileUrl ? (
                    <a href={fileUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      Baixar PDF
                    </a>
                  ) : (
                    '—'
                  )
                }
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
              {(['ativo', 'encerrado', 'cancelado'] as const)
                .filter((status) => status !== contract.status)
                .map((status) => (
                  <form key={status} action={updateContractStatus}>
                    <input type="hidden" name="id" value={contract.id} />
                    <input type="hidden" name="status" value={status} />
                    <Button type="submit" variant="secondary" size="sm">
                      Marcar como {status}
                    </Button>
                  </form>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo financeiro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col">
              <DetailRow label="Total pago" value={formatCurrencyCents(totalPaidCents)} />
              <DetailRow label="Total pendente" value={formatCurrencyCents(totalPendingCents)} />
              <DetailRow label="Parcelas" value={String(payments?.length ?? 0)} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pagamentos</CardTitle>
          <CardDescription>Cronograma gerado automaticamente na criação; adicione parcelas manualmente se necessário.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pago em</TableHead>
                <TableHead className="w-0">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payments ?? []).map((payment) => {
                const effectiveStatus = paymentEffectiveStatus({ status: payment.status, dueDate: payment.due_date });
                return (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDate(payment.due_date)}</TableCell>
                    <TableCell>{formatCurrencyCents(payment.amount_cents)}</TableCell>
                    <TableCell>
                      <PaymentStatusBadge status={effectiveStatus} />
                    </TableCell>
                    <TableCell>{payment.paid_at ? formatDate(payment.paid_at) : '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        {payment.status === 'pendente' ? (
                          <form action={markPaymentPaid}>
                            <input type="hidden" name="paymentId" value={payment.id} />
                            <input type="hidden" name="contractId" value={contract.id} />
                            <Button type="submit" size="sm">
                              Marcar como pago
                            </Button>
                          </form>
                        ) : (
                          <form action={reopenPayment}>
                            <input type="hidden" name="paymentId" value={payment.id} />
                            <input type="hidden" name="contractId" value={contract.id} />
                            <Button type="submit" variant="secondary" size="sm">
                              Reabrir
                            </Button>
                          </form>
                        )}
                        <ConfirmSubmitForm
                          action={deletePayment}
                          confirmMessage="Excluir esta parcela?"
                          buttonLabel="Excluir"
                          buttonSize="sm"
                        >
                          <input type="hidden" name="paymentId" value={payment.id} />
                          <input type="hidden" name="contractId" value={contract.id} />
                        </ConfirmSubmitForm>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(payments ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhuma parcela cadastrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <form action={addPayment} className="mt-4 flex flex-wrap items-end gap-4 border-t border-border pt-4">
            <input type="hidden" name="contractId" value={contract.id} />
            <div>
              <Label htmlFor="new-payment-due-date">Nova parcela — vencimento</Label>
              <Input id="new-payment-due-date" name="dueDate" type="date" required />
            </div>
            <div>
              <Label htmlFor="new-payment-amount">Valor</Label>
              <Input id="new-payment-amount" name="amount" type="text" inputMode="decimal" placeholder="0,00" required />
            </div>
            <Button type="submit" variant="secondary">
              Adicionar parcela
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
