import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatCurrencyCents, formatDate } from '@/lib/format';
import { computeDisplayStatus, computeVigenciaCountdown } from '@/lib/contract-status';
import {
  CONTRACT_DOCUMENT_STATUS_LABELS,
  CONTRACT_DOCUMENT_TYPES,
  CONTRACT_DOCUMENT_TYPE_LABELS,
  computeDocumentStatus,
  type ContractDocumentStatus,
} from '@/lib/contract-documents';
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
  CONTRACT_TYPE_LABELS,
  DEPARTMENT_LABELS,
  PAYMENT_PERIODICITY_LABELS,
  READJUSTMENT_INDEX_LABELS,
  type ClosureReason,
  type ContractDetailType,
  type Department,
} from '@/types/domain';
import { ContratoForm } from '../contrato-form';
import { CloseContractForm } from '../close-contract-form';
import {
  addAmendment,
  deleteAmendment,
  deleteContract,
  deleteContractDocument,
  updateContractStatus,
  upsertContractDocument,
} from '../actions';

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

const DOCUMENT_STATUS_TONES: Record<ContractDocumentStatus, BadgeTone> = {
  sem_documento: 'neutral',
  regular: 'success',
  vencendo: 'warning',
  vencido: 'destructive',
};

/** Item do quadro resumo: rótulo pequeno acima do valor, para caber em duas colunas. */
function SummaryItem({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}

function WhatsappIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 text-green-600"
      fill="currentColor"
      role="img"
      aria-label="WhatsApp"
    >
      <title>WhatsApp</title>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.04 2C6.5 2 2 6.5 2 12.04c0 1.77.46 3.5 1.34 5.02L2 22l5.07-1.33a10 10 0 0 0 4.97 1.27C17.58 21.94 22 17.5 22 12.04 22 6.5 17.58 2 12.04 2zm0 18.2a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.01.79.8-2.93-.2-.31a8.17 8.17 0 0 1-1.26-4.37c0-4.52 3.69-8.2 8.22-8.2 4.52 0 8.2 3.68 8.2 8.2 0 4.53-3.68 8.14-8.27 8.14z" />
    </svg>
  );
}

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

  const [{ data: profiles }, { data: amendments }, { data: documents }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, role').order('full_name'),
    supabase
      .from('contract_amendments')
      .select('*')
      .eq('contract_id', contract.id)
      .order('amendment_date', { ascending: false }),
    supabase.from('contract_documents').select('*').eq('contract_id', contract.id).order('created_at'),
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

  const documentList = documents ?? [];
  const documentFileUrls = new Map<string, string>();
  for (const document of documentList) {
    if (!document.file_path) continue;
    const { data: signed } = await supabase.storage
      .from('contracts')
      .createSignedUrl(document.file_path, SIGNED_URL_TTL_SECONDS);
    if (signed?.signedUrl) documentFileUrls.set(document.id, signed.signedUrl);
  }
  const documentStatuses = documentList.map((document) =>
    computeDocumentStatus(document.file_path, document.validity_date),
  );
  const attachedFixedCount = CONTRACT_DOCUMENT_TYPES.filter((type) =>
    documentList.some((document) => document.document_type === type && document.file_path),
  ).length;
  const expiringDocumentCount = documentStatuses.filter((status) => status === 'vencendo').length;
  const expiredDocumentCount = documentStatuses.filter((status) => status === 'vencido').length;
  const otherDocuments = documentList.filter((document) => document.document_type === 'outro');

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
          {contract.counterparty_cnpj && (
            <p className="mt-0.5 text-xs text-muted-foreground">CNPJ {contract.counterparty_cnpj}</p>
          )}
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
          <CardTitle>Dados do fornecedor/contrato</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <SummaryItem label="Status" value={<ContractStatusBadge status={displayStatus} />} />
            <SummaryItem
              label="Categoria"
              value={[
                CONTRACT_TYPE_LABELS[contract.contract_type],
                contract.contract_detail_type
                  ? (CONTRACT_DETAIL_TYPE_LABELS[contract.contract_detail_type as ContractDetailType] ??
                    contract.contract_detail_type)
                  : null,
              ]
                .filter(Boolean)
                .join(' - ')}
            />
            <SummaryItem label="Início da vigência" value={formatDate(contract.start_date)} />
            <SummaryItem
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
            {contract.renewal_notice_days != null && (
              <SummaryItem
                label="Aviso prévio"
                value={`${contract.renewal_notice_days} ${contract.renewal_notice_days === 1 ? 'dia' : 'dias'}`}
              />
            )}
            <SummaryItem
              label="Valor R$"
              value={
                contract.is_variable_value
                  ? 'Valor variável'
                  : `${formatCurrencyCents(contract.total_amount_cents ?? 0)}${
                      contract.payment_periodicity
                        ? ` (${PAYMENT_PERIODICITY_LABELS[contract.payment_periodicity].toLowerCase()})`
                        : ''
                    }`
              }
            />
            {contract.readjustment_index && contract.readjustment_index !== 'outro' && (
              <SummaryItem
                label="Reajuste"
                value={[
                  READJUSTMENT_INDEX_LABELS[contract.readjustment_index],
                  contract.readjustment_date ? `data-base ${formatDate(contract.readjustment_date)}` : null,
                ]
                  .filter(Boolean)
                  .join(' — ')}
              />
            )}
            {contract.contact_email && <SummaryItem label="Email" value={contract.contact_email} />}
            {contract.representative_name && <SummaryItem label="Contato" value={contract.representative_name} />}
            {(contract.contact_phone || contract.contact_phone_2) && (
              <SummaryItem
                label="Telefone"
                value={
                  <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    {contract.contact_phone && (
                      <span className="flex items-center gap-1">
                        {contract.contact_phone}
                        {contract.is_whatsapp && <WhatsappIcon />}
                      </span>
                    )}
                    {contract.contact_phone_2 && (
                      <span className="flex items-center gap-1">
                        {contract.contact_phone_2}
                        {contract.is_whatsapp_2 && <WhatsappIcon />}
                      </span>
                    )}
                  </span>
                }
              />
            )}
            {contract.invoice_reminder_days && (
              <SummaryItem
                label="Alerta faturamento"
                value={`Dia ${contract.invoice_reminder_days
                  .split(',')
                  .map((day) => day.trim().padStart(2, '0'))
                  .join(', ')}`}
              />
            )}
            <SummaryItem label="Arquivo do contrato" value={fileUrl ? 'Sim' : 'Não'} />
            <SummaryItem label="Distrato" value={contract.has_distrato ? 'Sim' : 'Não'} />
            <SummaryItem label="Aditivo" value={amendmentCount > 0 ? `Sim (${amendmentCount})` : 'Não'} />
            {contract.variable_payment_note && (
              <SummaryItem label="Variável/Comissão" value={contract.variable_payment_note} wide />
            )}
            {contract.notes && <SummaryItem label="Observações" value={contract.notes} wide />}
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
          <CardTitle>Alerta de faturamento</CardTitle>
          <CardDescription>Alerta enviado 10 dias corridos antes de cada data de pagamento.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex max-w-2xl flex-col">
            {contract.financial_email && (
              <DetailRow label="E-mail financeiro" value={contract.financial_email} />
            )}
            {contract.fixed_payment_date && (
              <DetailRow label="Data do pagamento fixo" value={formatDate(contract.fixed_payment_date)} />
            )}
            {contract.variable_payment_date && (
              <DetailRow label="Data do pagamento variável" value={formatDate(contract.variable_payment_date)} />
            )}
            {!contract.financial_email && !contract.fixed_payment_date && !contract.variable_payment_date && (
              <p className="text-sm text-muted-foreground">Nenhum dado financeiro cadastrado.</p>
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
          <CardTitle>Documentação de habilitação e regularidade</CardTitle>
          <CardDescription>
            Documentos para qualificar o fornecedor. Certidões com validade entram em alerta 30 dias antes do
            vencimento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge tone="neutral">
              {attachedFixedCount} de {CONTRACT_DOCUMENT_TYPES.length} anexados
            </Badge>
            {expiringDocumentCount > 0 && <Badge tone="warning">{expiringDocumentCount} vencendo</Badge>}
            {expiredDocumentCount > 0 && <Badge tone="destructive">{expiredDocumentCount} vencido(s)</Badge>}
          </div>

          <div className="flex flex-col divide-y divide-border">
            {CONTRACT_DOCUMENT_TYPES.map((type) => {
              const document = documentList.find((item) => item.document_type === type);
              const status = computeDocumentStatus(document?.file_path ?? null, document?.validity_date ?? null);
              const url = document ? documentFileUrls.get(document.id) : undefined;
              return (
                <div key={type} className="flex flex-col gap-3 py-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{CONTRACT_DOCUMENT_TYPE_LABELS[type]}</span>
                    <Badge tone={DOCUMENT_STATUS_TONES[status]}>{CONTRACT_DOCUMENT_STATUS_LABELS[status]}</Badge>
                    {url && (
                      <a href={url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                        Baixar PDF
                      </a>
                    )}
                  </div>
                  <form action={upsertContractDocument} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="contractId" value={contract.id} />
                    <input type="hidden" name="documentType" value={type} />
                    <div>
                      <Label htmlFor={`doc-validity-${type}`} className="text-xs">
                        Validade
                      </Label>
                      <Input
                        id={`doc-validity-${type}`}
                        name="validityDate"
                        type="date"
                        defaultValue={document?.validity_date?.slice(0, 10) ?? ''}
                        className="w-40"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`doc-file-${type}`} className="text-xs">
                        {document?.file_path ? 'Substituir arquivo (PDF)' : 'Arquivo (PDF)'}
                      </Label>
                      <Input id={`doc-file-${type}`} name="file" type="file" accept="application/pdf" />
                    </div>
                    <Button type="submit" variant="secondary" size="sm" className="mb-1">
                      Salvar
                    </Button>
                  </form>
                </div>
              );
            })}
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <h3 className="text-sm font-semibold">Outros documentos</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {otherDocuments.map((document) => {
                  const status = computeDocumentStatus(document.file_path, document.validity_date);
                  const url = documentFileUrls.get(document.id);
                  return (
                    <TableRow key={document.id}>
                      <TableCell>{document.label ?? '—'}</TableCell>
                      <TableCell>{document.validity_date ? formatDate(document.validity_date) : '—'}</TableCell>
                      <TableCell>
                        <Badge tone={DOCUMENT_STATUS_TONES[status]}>{CONTRACT_DOCUMENT_STATUS_LABELS[status]}</Badge>
                      </TableCell>
                      <TableCell>
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                            Baixar PDF
                          </a>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <ConfirmSubmitForm
                          action={deleteContractDocument}
                          confirmMessage="Excluir este documento?"
                          buttonLabel="Excluir"
                          buttonSize="sm"
                        >
                          <input type="hidden" name="documentId" value={document.id} />
                          <input type="hidden" name="contractId" value={contract.id} />
                        </ConfirmSubmitForm>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {otherDocuments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhum outro documento anexado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <form action={upsertContractDocument} className="mt-4 flex flex-wrap items-end gap-2">
              <input type="hidden" name="contractId" value={contract.id} />
              <input type="hidden" name="documentType" value="outro" />
              <div>
                <Label htmlFor="doc-outro-label" className="text-xs">
                  Nome do documento
                </Label>
                <Input id="doc-outro-label" name="label" type="text" placeholder="Ex.: Licença ambiental" required />
              </div>
              <div>
                <Label htmlFor="doc-outro-validity" className="text-xs">
                  Validade (opcional)
                </Label>
                <Input id="doc-outro-validity" name="validityDate" type="date" className="w-40" />
              </div>
              <div>
                <Label htmlFor="doc-outro-file" className="text-xs">
                  Arquivo (PDF)
                </Label>
                <Input id="doc-outro-file" name="file" type="file" accept="application/pdf" />
              </div>
              <Button type="submit" variant="secondary" size="sm" className="mb-1">
                Adicionar
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

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

    </div>
  );
}
