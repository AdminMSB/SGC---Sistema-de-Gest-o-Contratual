import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatCurrencyCents, formatDate, formatDateTime } from '@/lib/format';
import type { ExtractedHighlights } from '@/lib/pdf-extract';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ContractStatusBadge } from '@/components/status-badge';
import { ConfirmSubmitForm } from '@/components/confirm-submit-form';
import {
  AMENDMENT_STATUS_LABELS,
  CONTRACT_DETAIL_TYPE_LABELS,
  CONTRACT_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  READJUSTMENT_INDEX_LABELS,
} from '@/types/domain';
import { ContratoForm } from '../contrato-form';
import {
  addAmendment,
  deleteAmendment,
  deleteContract,
  updateAmendmentStatus,
  updateContractStatus,
} from '../actions';

function ExtractedHighlightsCard({ highlights }: { highlights: ExtractedHighlights | null }) {
  if (!highlights) return null;

  const hasContent =
    highlights.dates.length > 0 ||
    highlights.amountsCents.length > 0 ||
    highlights.cnpjs.length > 0 ||
    highlights.clauses.length > 0 ||
    highlights.duration != null ||
    highlights.objectSummary != null;
  if (!hasContent) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Destaques extraídos do PDF</CardTitle>
        <CardDescription>
          Identificados automaticamente por padrões de texto no arquivo enviado — confira sempre
          contra o documento original.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col">
          {highlights.objectSummary && <DetailRow label="Objeto (extraído do PDF)" value={highlights.objectSummary} />}
          {highlights.dates.length > 0 && (
            <DetailRow label="Datas encontradas" value={highlights.dates.map(formatDate).join(', ')} />
          )}
          {highlights.amountsCents.length > 0 && (
            <DetailRow
              label="Valores encontrados"
              value={highlights.amountsCents.map(formatCurrencyCents).join(', ')}
            />
          )}
          {highlights.duration != null && (
            <DetailRow
              label="Prazo de vigência mencionado"
              value={`${highlights.duration.amount} ${highlights.duration.unit}`}
            />
          )}
          {highlights.readjustmentPeriodMonths != null && (
            <DetailRow
              label="Período de reajuste mencionado"
              value={`${highlights.readjustmentPeriodMonths} mês(es)`}
            />
          )}
          {highlights.cnpjs.length > 0 && (
            <DetailRow label="CNPJs encontrados" value={highlights.cnpjs.join(', ')} />
          )}
          {highlights.clauses.length > 0 && (
            <DetailRow label="Cláusulas notáveis" value={highlights.clauses.join(', ')} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

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

  const [{ data: managers }, { data: profiles }, { data: amendments }, { data: statusHistory }] =
    await Promise.all([
      supabase.from('contract_managers').select('id, full_name').order('full_name'),
      supabase.from('profiles').select('id, full_name').order('full_name'),
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
    const { data: signed } = await supabase.storage.from('contracts').createSignedUrl(contract.file_path, 300);
    fileUrl = signed?.signedUrl ?? null;
  }

  let distratoFileUrl: string | null = null;
  if (contract.distrato_file_path) {
    const { data: signed } = await supabase.storage
      .from('contracts')
      .createSignedUrl(contract.distrato_file_path, 300);
    distratoFileUrl = signed?.signedUrl ?? null;
  }

  const managerNameById = new Map((managers ?? []).map((manager) => [manager.id, manager.full_name]));
  const profileNameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
  const amendmentCount = (amendments ?? []).length;

  const amendmentFileUrls = new Map<string, string>();
  for (const amendment of amendments ?? []) {
    if (!amendment.file_path) continue;
    const { data: signed } = await supabase.storage.from('contracts').createSignedUrl(amendment.file_path, 300);
    if (signed?.signedUrl) amendmentFileUrls.set(amendment.id, signed.signedUrl);
  }

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
          <ContratoForm mode="edit" contract={contract} managers={managers ?? []} triggerVariant="secondary" />
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

      <Card>
        <CardHeader>
          <CardTitle>Dados do contrato</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col">
            {contract.internal_code && <DetailRow label="Código interno" value={contract.internal_code} />}
            {contract.department && <DetailRow label="Departamento" value={contract.department} />}
            {contract.internal_manager_id && managerNameById.get(contract.internal_manager_id) && (
              <DetailRow label="Gestor do contrato" value={managerNameById.get(contract.internal_manager_id)!} />
            )}
            <DetailRow label="Categoria" value={CONTRACT_TYPE_LABELS[contract.contract_type]} />
            {contract.contract_detail_type && (
              <DetailRow label="Detalhamento" value={CONTRACT_DETAIL_TYPE_LABELS[contract.contract_detail_type]} />
            )}
            {contract.counterparty_cnpj && (
              <DetailRow label="CNPJ da contraparte" value={contract.counterparty_cnpj} />
            )}
            {contract.representative_name && (
              <DetailRow label="Representante" value={contract.representative_name} />
            )}
            {contract.contact_email && <DetailRow label="E-mail de contato" value={contract.contact_email} />}
            {contract.contact_phone && <DetailRow label="Telefone de contato" value={contract.contact_phone} />}
            {contract.alert_emails && <DetailRow label="E-mails para alerta" value={contract.alert_emails} />}
            <DetailRow label="Status" value={<ContractStatusBadge status={contract.status} />} />
            <DetailRow label="Início da vigência" value={formatDate(contract.start_date)} />
            <DetailRow
              label="Fim da vigência"
              value={contract.end_date ? formatDate(contract.end_date) : 'Indeterminado'}
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
                  contract.readjustment_period_months != null
                    ? `${READJUSTMENT_INDEX_LABELS[contract.readjustment_index]} a cada ${contract.readjustment_period_months} mês(es)`
                    : READJUSTMENT_INDEX_LABELS[contract.readjustment_index]
                }
              />
            )}
            {contract.termination_reason && (
              <DetailRow label="Motivo de encerramento/rescisão" value={contract.termination_reason} />
            )}
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
            <DetailRow
              label="Distrato"
              value={
                contract.has_distrato ? (
                  distratoFileUrl ? (
                    <a href={distratoFileUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      Sim — Baixar PDF
                    </a>
                  ) : (
                    'Sim'
                  )
                ) : (
                  'Não'
                )
              }
            />
            <DetailRow
              label="Aditivo"
              value={amendmentCount > 0 ? `Sim (${amendmentCount})` : 'Não'}
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

      <ExtractedHighlightsCard highlights={contract.extracted_highlights} />

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
                <TableHead>Status</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead className="w-0">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(amendments ?? []).map((amendment) => {
                const nextStatus = amendment.status === 'assinado' ? 'em_analise' : 'assinado';
                return (
                  <TableRow key={amendment.id}>
                    <TableCell>{formatDate(amendment.amendment_date)}</TableCell>
                    <TableCell>{amendment.document_name ?? '—'}</TableCell>
                    <TableCell>{amendment.description}</TableCell>
                    <TableCell>
                      <Badge tone={amendment.status === 'assinado' ? 'success' : 'warning'}>
                        {AMENDMENT_STATUS_LABELS[amendment.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {amendmentFileUrls.has(amendment.id) ? (
                        <a
                          href={amendmentFileUrls.get(amendment.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          Baixar PDF
                        </a>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <form action={updateAmendmentStatus}>
                          <input type="hidden" name="amendmentId" value={amendment.id} />
                          <input type="hidden" name="contractId" value={contract.id} />
                          <input type="hidden" name="status" value={nextStatus} />
                          <Button type="submit" variant="secondary" size="sm">
                            Marcar como {AMENDMENT_STATUS_LABELS[nextStatus].toLowerCase()}
                          </Button>
                        </form>
                        <ConfirmSubmitForm
                          action={deleteAmendment}
                          confirmMessage="Excluir este aditivo?"
                          buttonLabel="Excluir"
                          buttonSize="sm"
                        >
                          <input type="hidden" name="amendmentId" value={amendment.id} />
                          <input type="hidden" name="contractId" value={contract.id} />
                        </ConfirmSubmitForm>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(amendments ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="new-amendment-status">Status</Label>
                <Select id="new-amendment-status" name="status" defaultValue="em_analise">
                  {Object.entries(AMENDMENT_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="new-amendment-file">Documento (PDF, opcional)</Label>
                <Input id="new-amendment-file" name="file" type="file" accept="application/pdf" />
              </div>
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
                  <TableCell>{entry.old_status ? CONTRACT_STATUS_LABELS[entry.old_status] : '—'}</TableCell>
                  <TableCell>{CONTRACT_STATUS_LABELS[entry.new_status]}</TableCell>
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
