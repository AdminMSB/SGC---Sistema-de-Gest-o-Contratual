import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatCurrencyCents, formatDate, formatDateTime } from '@/lib/format';
import { computeDisplayStatus, computeVigenciaCountdown } from '@/lib/contract-status';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ContractStatusBadge } from '@/components/status-badge';
import { ConfirmSubmitForm } from '@/components/confirm-submit-form';
import {
  CLOSURE_REASON_LABELS,
  CONTRACT_DETAIL_TYPE_LABELS,
  CONTRACT_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  DEPARTMENT_LABELS,
  READJUSTMENT_INDEX_LABELS,
  type ClosureReason,
  type ContractDetailType,
  type Department,
} from '@/types/domain';
import { ContratoForm } from '../contrato-form';
import { CloseContractForm } from '../close-contract-form';
import { addAmendment, deleteAmendment, deleteContract, updateContractStatus } from '../actions';

// URL assinada de longa duração — a página fica aberta enquanto a pessoa revisa o contrato,
// e um link que expira em minutos gera "exp claim timestamp check failed" ao clicar depois.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

const CLOSURE_BANNER_CLASSES: Record<ClosureReason, string> = {
  inativo: 'border-border bg-muted text-muted-foreground',
  encerrado: 'border-border bg-muted text-muted-foreground',
  cancelado: 'border-destructive/30 bg-destructive/10 text-destructive',
};

const TIMELINE_TYPE_TONES: Record<'Contrato' | 'Aditivo' | 'Distrato', BadgeTone> = {
  Contrato: 'info',
  Aditivo: 'neutral',
  Distrato: 'destructive',
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2 last:border-0 sm:grid sm:grid-cols-[220px_1fr] sm:items-baseline sm:gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
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

  const [{ data: profiles }, { data: amendments }, { data: statusHistory }] =
    await Promise.all([
      supabase.from('profiles').select('id, full_name, role').order('full_name'),
      supabase
        .from('contract_amendments')
        .select('*')
        .eq('contract_id', contract.id)
        .order('amendment_date', { ascending: false }),
      supabase
        .from('contract_status_history')
        .select('*')
        .eq('contract_id', contract.id)
        .order('changed_at', { ascending: false }),
    ]);

  let fileUrl: string | null = null;
  if (contract.file_path) {
    const { data: signed } = await supabase.storage
      .from('contracts')
      .createSignedUrl(contract.file_path, SIGNED_URL_TTL_SECONDS);
    fileUrl = signed?.signedUrl ?? null;
  }

  let distratoFileUrl: string | null = null;
  if (contract.distrato_file_path) {
    const { data: signed } = await supabase.storage
      .from('contracts')
      .createSignedUrl(contract.distrato_file_path, SIGNED_URL_TTL_SECONDS);
    distratoFileUrl = signed?.signedUrl ?? null;
  }

  const managers = (profiles ?? []).filter((profile) => profile.role === 'gestor');
  const profileNameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
  const amendmentCount = (amendments ?? []).length;
  const displayStatus = computeDisplayStatus(contract.status, contract.end_date);
  const vigenciaCountdown = computeVigenciaCountdown(contract.end_date);

  const amendmentFileUrls = new Map<string, string>();
  for (const amendment of amendments ?? []) {
    if (!amendment.file_path) continue;
    const { data: signed } = await supabase.storage
      .from('contracts')
      .createSignedUrl(amendment.file_path, SIGNED_URL_TTL_SECONDS);
    if (signed?.signedUrl) amendmentFileUrls.set(amendment.id, signed.signedUrl);
  }

  const timelineEntries: {
    date: string;
    type: 'Contrato' | 'Aditivo' | 'Distrato';
    title: string;
    description: string | null;
    fileUrl: string | null;
  }[] = [
    {
      date: contract.start_date,
      type: 'Contrato' as const,
      title: 'Assinatura do contrato',
      description: contract.title,
      fileUrl,
    },
    ...(amendments ?? []).map((amendment) => ({
      date: amendment.amendment_date,
      type: 'Aditivo' as const,
      title: amendment.document_name ?? 'Aditivo',
      description: amendment.description,
      fileUrl: amendmentFileUrls.get(amendment.id) ?? null,
    })),
    ...(contract.has_distrato && contract.distrato_date
      ? [
          {
            date: contract.distrato_date,
            type: 'Distrato' as const,
            title: 'Distrato',
            description: null,
            fileUrl: distratoFileUrl,
          },
        ]
      : []),
  ].sort((a, b) => a.date.localeCompare(b.date));

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
        </div>
        <div className="flex items-center gap-2">
          <ContratoForm mode="edit" contract={contract} managers={managers} triggerVariant="secondary" />
          {profile.role === 'admin' && (
            <ConfirmSubmitForm
              action={deleteContract}
              confirmMessage="Excluir este contrato e todo o histórico associado? Esta ação não pode ser desfeita."
              buttonLabel="Excluir"
            >
              <input type="hidden" name="id" value={contract.id} />
            </ConfirmSubmitForm>
          )}
        </div>
      </div>

      {contract.status === 'encerrado' && (
        <div
          className={
            'rounded-md border px-4 py-3 text-sm font-medium ' +
            CLOSURE_BANNER_CLASSES[contract.closure_reason ?? 'encerrado']
          }
        >
          Contrato {CLOSURE_REASON_LABELS[contract.closure_reason ?? 'encerrado'].toLowerCase()}.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
      <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Dados do contrato e do fornecedor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex max-w-2xl flex-col">
            <DetailRow label="Status" value={<ContractStatusBadge status={displayStatus} />} />
            <DetailRow label="Categoria" value={CONTRACT_TYPE_LABELS[contract.contract_type]} />
            {contract.contract_detail_type && (
              <DetailRow
                label="Detalhamento"
                value={
                  CONTRACT_DETAIL_TYPE_LABELS[contract.contract_detail_type as ContractDetailType] ??
                  contract.contract_detail_type
                }
              />
            )}
            <DetailRow label="Início da vigência" value={formatDate(contract.start_date)} />
            <DetailRow
              label="Fim da vigência"
              value={
                contract.end_date ? (
                  <span className="flex flex-wrap items-center gap-2">
                    {formatDate(contract.end_date)}
                    {vigenciaCountdown && (
                      <Badge
                        tone={vigenciaCountdown.tone}
                        className={vigenciaCountdown.tone !== 'neutral' ? 'animate-pulse' : undefined}
                      >
                        {vigenciaCountdown.label}
                      </Badge>
                    )}
                  </span>
                ) : (
                  'Indeterminado'
                )
              }
            />
            <DetailRow label="Aviso prévio" value={`${contract.renewal_notice_days} dia(s)`} />
            <DetailRow
              label="Valor total do contrato"
              value={contract.is_variable_value ? 'Valor variável' : formatCurrencyCents(contract.total_amount_cents ?? 0)}
            />
            {contract.readjustment_index && (
              <DetailRow
                label="Reajuste"
                value={
                  contract.readjustment_date
                    ? `${READJUSTMENT_INDEX_LABELS[contract.readjustment_index]} — previsto para ${formatDate(contract.readjustment_date)}`
                    : READJUSTMENT_INDEX_LABELS[contract.readjustment_index]
                }
              />
            )}
            {contract.variable_payment_note && (
              <DetailRow label="Pagamento variável adicional" value={contract.variable_payment_note} />
            )}
            {contract.notes && <DetailRow label="Observações" value={contract.notes} />}
            {contract.counterparty_cnpj && (
              <DetailRow label="CNPJ Fornecedor" value={contract.counterparty_cnpj} />
            )}
            {contract.representative_name && (
              <DetailRow label="Contato" value={contract.representative_name} />
            )}
            {contract.contact_email && <DetailRow label="Email" value={contract.contact_email} />}
            {contract.contact_phone && (
              <DetailRow
                label="Telefone de contato"
                value={contract.is_whatsapp ? `${contract.contact_phone} (WhatsApp)` : contract.contact_phone}
              />
            )}
            {contract.contact_phone_2 && (
              <DetailRow label="Telefone de contato (2)" value={contract.contact_phone_2} />
            )}
            <DetailRow label="Arquivo do contrato" value={fileUrl ? 'Sim' : 'Não'} />
            <DetailRow label="Distrato" value={contract.has_distrato ? 'Sim' : 'Não'} />
            <DetailRow
              label="Aditivo"
              value={amendmentCount > 0 ? `Sim (${amendmentCount})` : 'Não'}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            {contract.status === 'ativo' && <CloseContractForm contractId={contract.id} />}
            {contract.status === 'encerrado' && (
              <form action={updateContractStatus}>
                <input type="hidden" name="id" value={contract.id} />
                <input type="hidden" name="status" value="ativo" />
                <Button type="submit" variant="secondary" size="sm">
                  Marcar como ativo
                </Button>
              </form>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados gerenciais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex max-w-2xl flex-col">
            {contract.internal_manager_id && profileNameById.get(contract.internal_manager_id) && (
              <DetailRow label="Gestor do contrato" value={profileNameById.get(contract.internal_manager_id)!} />
            )}
            {contract.internal_code && <DetailRow label="Código D365" value={contract.internal_code} />}
            {contract.department && (
              <DetailRow
                label="Centro de custo"
                value={DEPARTMENT_LABELS[contract.department as Department] ?? contract.department}
              />
            )}
            {contract.alert_emails && <DetailRow label="E-mails para alerta" value={contract.alert_emails} />}
          </div>
        </CardContent>
      </Card>
      </div>

      {fileUrl && (
        <Card className="lg:sticky lg:top-6">
          <CardContent className="pt-4 sm:pt-6">
            <iframe
              src={fileUrl}
              title="Arquivo do contrato (PDF)"
              className="h-[800px] w-full rounded-md border border-border"
            />
          </CardContent>
        </Card>
      )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aditivos</CardTitle>
          <CardDescription>Alterações, prorrogações ou reajustes formalizados após a assinatura original.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Nome do documento</TableHead>
                <TableHead>Resumo</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(amendments ?? []).map((amendment) => (
                <TableRow key={amendment.id}>
                  <TableCell>{formatDate(amendment.amendment_date)}</TableCell>
                  <TableCell>{amendment.document_name ?? '—'}</TableCell>
                  <TableCell>{amendment.description}</TableCell>
                  <TableCell>
                    <ConfirmSubmitForm
                      action={deleteAmendment}
                      confirmMessage="Excluir este aditivo?"
                      buttonLabel="Excluir"
                      buttonSize="sm"
                    >
                      <input type="hidden" name="amendmentId" value={amendment.id} />
                      <input type="hidden" name="contractId" value={contract.id} />
                    </ConfirmSubmitForm>
                  </TableCell>
                </TableRow>
              ))}
              {(amendments ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhum aditivo registrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <form action={addAmendment} className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
            <input type="hidden" name="contractId" value={contract.id} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="new-amendment-name">Nome do documento</Label>
                <Input id="new-amendment-name" name="documentName" type="text" placeholder="Ex.: 1º Termo Aditivo" />
              </div>
              <div>
                <Label htmlFor="new-amendment-date">Data do aditivo</Label>
                <Input id="new-amendment-date" name="amendmentDate" type="date" required />
              </div>
            </div>
            <div>
              <Label htmlFor="new-amendment-file">Documento (PDF, opcional)</Label>
              <Input id="new-amendment-file" name="file" type="file" accept="application/pdf" />
            </div>
            <div>
              <Label htmlFor="new-amendment-description">Resumo do documento</Label>
              <Textarea id="new-amendment-description" name="description" rows={2} required />
            </div>
            <div>
              <Button type="submit" variant="secondary">
                Adicionar aditivo
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linha do tempo do contrato</CardTitle>
          <CardDescription>
            Assinatura, aditivos e distrato, em ordem cronológica pela data de cada documento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Documento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timelineEntries.map((entry, index) => (
                <TableRow key={`${entry.type}-${entry.date}-${index}`}>
                  <TableCell>{formatDate(entry.date)}</TableCell>
                  <TableCell>
                    <Badge tone={TIMELINE_TYPE_TONES[entry.type]}>{entry.type}</Badge>
                  </TableCell>
                  <TableCell>{entry.title}</TableCell>
                  <TableCell>{entry.description ?? '—'}</TableCell>
                  <TableCell>
                    {entry.fileUrl ? (
                      <a href={entry.fileUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        Baixar PDF
                      </a>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de status</CardTitle>
          <CardDescription>Registrado automaticamente a cada mudança de status.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>De</TableHead>
                <TableHead>Para</TableHead>
                <TableHead>Por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(statusHistory ?? []).map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{formatDateTime(entry.changed_at)}</TableCell>
                  <TableCell>{entry.old_status ? (CONTRACT_STATUS_LABELS[entry.old_status] ?? entry.old_status) : '—'}</TableCell>
                  <TableCell>{CONTRACT_STATUS_LABELS[entry.new_status] ?? entry.new_status}</TableCell>
                  <TableCell>{entry.changed_by ? profileNameById.get(entry.changed_by) ?? '—' : '—'}</TableCell>
                </TableRow>
              ))}
              {(statusHistory ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhuma mudança de status registrada ainda.
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
