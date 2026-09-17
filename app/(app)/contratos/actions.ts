'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireProfile, requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { parseCurrencyToCents } from '@/lib/format';
import { extractTextFromPdf } from '@/lib/pdf-text';
import { extractHighlightsFromText, type ExtractedHighlights } from '@/lib/pdf-extract';

const ACCEPTED_FILE_TYPES = ['application/pdf'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const contractSchema = z.object({
  title: z.string().trim().min(1, 'Informe o nome/objeto do contrato.'),
  counterpartyCnpj: z.string(),
  contractType: z.enum(['servico', 'locacao', 'fornecimento', 'comodato', 'consultoria']),
  contractDetailType: z.enum([
    'manutencao',
    'licenca_uso',
    'mao_de_obra',
    'prestacao_servico_terceiros',
    'servicos_advocaticios',
    'gestao_viagens',
    'seguro_patrimonial',
    'seguro_predial',
    'seguro_auto',
    'outro',
    '',
  ]),
  startDate: z.string().min(1, 'Informe a data de início.'),
  endDate: z.string(),
  renewalNoticeDays: z.string(),
  amount: z.string(),
  isVariableValue: z.string(),
  readjustmentIndex: z.enum(['igpm', 'ipca', 'inpc', 'outro', '']),
  readjustmentPeriodMonths: z.string(),
  hasDistrato: z.string(),
  representativeName: z.string(),
  contactEmail: z.string(),
  contactPhone: z.string(),
  internalCode: z.string(),
  department: z.enum([
    'administrativo',
    'manutencao',
    'garantia_qualidade',
    'controle_qualidade',
    'comercial_vendas',
    'marketing',
    'contabilidade',
    'financeiro',
    'producao',
    'projetos_ti',
    'engenharia',
    'diretoria_executiva',
    'juridico',
    '',
  ]),
  internalManagerId: z.string(),
  terminationReason: z.string(),
  alertEmails: z.string(),
  notes: z.string(),
});

function fail(message: string): never {
  redirect(`/contratos?error=${encodeURIComponent(message)}`);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseContractFields(formData: FormData) {
  const parsed = contractSchema.safeParse({
    title: String(formData.get('title') ?? ''),
    counterpartyCnpj: String(formData.get('counterpartyCnpj') ?? ''),
    contractType: String(formData.get('contractType') ?? ''),
    contractDetailType: String(formData.get('contractDetailType') ?? ''),
    startDate: String(formData.get('startDate') ?? ''),
    endDate: String(formData.get('endDate') ?? ''),
    renewalNoticeDays: String(formData.get('renewalNoticeDays') ?? ''),
    amount: String(formData.get('amount') ?? ''),
    isVariableValue: String(formData.get('isVariableValue') ?? ''),
    readjustmentIndex: String(formData.get('readjustmentIndex') ?? ''),
    readjustmentPeriodMonths: String(formData.get('readjustmentPeriodMonths') ?? ''),
    hasDistrato: String(formData.get('hasDistrato') ?? ''),
    representativeName: String(formData.get('representativeName') ?? ''),
    contactEmail: String(formData.get('contactEmail') ?? ''),
    contactPhone: String(formData.get('contactPhone') ?? ''),
    internalCode: String(formData.get('internalCode') ?? ''),
    department: String(formData.get('department') ?? ''),
    internalManagerId: String(formData.get('internalManagerId') ?? ''),
    terminationReason: String(formData.get('terminationReason') ?? ''),
    alertEmails: String(formData.get('alertEmails') ?? ''),
    notes: String(formData.get('notes') ?? ''),
  });

  if (!parsed.success) {
    fail(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
  }

  const isVariableValue = parsed.data.isVariableValue === 'on';
  let amountCents: number | null = null;
  if (!isVariableValue) {
    amountCents = parseCurrencyToCents(parsed.data.amount);
    if (amountCents <= 0) {
      fail('Informe um valor válido maior que zero, ou marque "Valor variável".');
    }
  }

  const endDate = parsed.data.endDate.trim() || null;
  if (endDate && endDate < parsed.data.startDate) {
    fail('A data de término não pode ser anterior à data de início.');
  }

  const renewalNoticeDays = Number.parseInt(parsed.data.renewalNoticeDays, 10);
  const readjustmentPeriodMonths = Number.parseInt(parsed.data.readjustmentPeriodMonths, 10);

  const contactEmail = parsed.data.contactEmail.trim();
  if (contactEmail && !EMAIL_PATTERN.test(contactEmail)) {
    fail('Informe um e-mail de contato válido.');
  }

  const alertEmails = parsed.data.alertEmails
    .split(/[,;\s]+/)
    .map((email) => email.trim())
    .filter(Boolean);
  const invalidAlertEmail = alertEmails.find((email) => !EMAIL_PATTERN.test(email));
  if (invalidAlertEmail) {
    fail(`E-mail de alerta inválido: ${invalidAlertEmail}`);
  }

  return {
    ...parsed.data,
    endDate,
    amountCents,
    isVariableValue,
    renewalNoticeDays: Number.isFinite(renewalNoticeDays) && renewalNoticeDays >= 0 ? renewalNoticeDays : 30,
    contractDetailType: parsed.data.contractDetailType || null,
    readjustmentIndex: parsed.data.readjustmentIndex || null,
    readjustmentPeriodMonths:
      Number.isFinite(readjustmentPeriodMonths) && readjustmentPeriodMonths >= 0 ? readjustmentPeriodMonths : null,
    counterpartyCnpj: parsed.data.counterpartyCnpj.trim() || null,
    hasDistrato: parsed.data.hasDistrato === 'on',
    representativeName: parsed.data.representativeName.trim() || null,
    contactEmail: contactEmail || null,
    contactPhone: parsed.data.contactPhone.trim() || null,
    internalCode: parsed.data.internalCode.trim() || null,
    department: parsed.data.department.trim() || null,
    internalManagerId: parsed.data.internalManagerId.trim() || null,
    terminationReason: parsed.data.terminationReason.trim() || null,
    alertEmails: alertEmails.length > 0 ? alertEmails.join(', ') : null,
  };
}

function extractPdfFile(formData: FormData, fieldName: string, errorLabel: string): File | null {
  const entry = formData.get(fieldName);
  const file = entry instanceof File && entry.size > 0 ? entry : null;
  if (!file) return null;

  if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
    fail(`O arquivo ${errorLabel} deve ser um PDF.`);
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    fail(`O arquivo ${errorLabel} deve ter no máximo 10MB.`);
  }

  return file;
}

async function extractHighlights(file: File): Promise<ExtractedHighlights | null> {
  const text = await extractTextFromPdf(Buffer.from(await file.arrayBuffer()));
  return text.trim() ? extractHighlightsFromText(text) : null;
}

export async function createContract(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  const fields = parseContractFields(formData);
  const file = extractPdfFile(formData, 'file', 'do contrato');
  const distratoFile = extractPdfFile(formData, 'distratoFile', 'do distrato');

  const { data: inserted, error: insertError } = await supabase
    .from('contracts')
    .insert({
      title: fields.title,
      counterparty: fields.title,
      counterparty_cnpj: fields.counterpartyCnpj,
      contract_type: fields.contractType,
      contract_detail_type: fields.contractDetailType,
      start_date: fields.startDate,
      end_date: fields.endDate,
      renewal_notice_days: fields.renewalNoticeDays,
      total_amount_cents: fields.amountCents,
      is_variable_value: fields.isVariableValue,
      readjustment_index: fields.readjustmentIndex,
      readjustment_period_months: fields.readjustmentPeriodMonths,
      has_distrato: fields.hasDistrato,
      representative_name: fields.representativeName,
      contact_email: fields.contactEmail,
      contact_phone: fields.contactPhone,
      internal_code: fields.internalCode,
      department: fields.department,
      internal_manager_id: fields.internalManagerId,
      termination_reason: fields.terminationReason,
      alert_emails: fields.alertEmails,
      notes: fields.notes || null,
      created_by: profile.id,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    fail('Não foi possível registrar o contrato. Tente novamente.');
  }

  if (file) {
    const extension = file.name.includes('.') ? file.name.split('.').pop() : 'pdf';
    const path = `${inserted.id}/contrato.${extension}`;
    const [{ error: uploadError }, highlights] = await Promise.all([
      supabase.storage.from('contracts').upload(path, file, {
        contentType: file.type,
        upsert: true,
      }),
      extractHighlights(file),
    ]);
    if (!uploadError) {
      await supabase
        .from('contracts')
        .update({ file_path: path, extracted_highlights: highlights })
        .eq('id', inserted.id);
    }
  }

  if (distratoFile) {
    const extension = distratoFile.name.includes('.') ? distratoFile.name.split('.').pop() : 'pdf';
    const path = `${inserted.id}/distrato.${extension}`;
    const { error: uploadError } = await supabase.storage.from('contracts').upload(path, distratoFile, {
      contentType: distratoFile.type,
      upsert: true,
    });
    if (!uploadError) {
      await supabase.from('contracts').update({ distrato_file_path: path }).eq('id', inserted.id);
    }
  }

  revalidatePath('/contratos');
  redirect(`/contratos/${inserted.id}`);
}

export async function updateContract(formData: FormData) {
  await requireProfile();
  const supabase = await createServerSupabaseClient();

  const id = String(formData.get('id') ?? '');
  if (!id) fail('Contrato inválido.');

  const fields = parseContractFields(formData);
  const file = extractPdfFile(formData, 'file', 'do contrato');
  const distratoFile = extractPdfFile(formData, 'distratoFile', 'do distrato');

  const { data: existing } = await supabase
    .from('contracts')
    .select('id, file_path, distrato_file_path')
    .eq('id', id)
    .single();
  if (!existing) fail('Contrato não encontrado.');

  let filePath = existing.file_path;
  let extractedHighlights: ExtractedHighlights | null = null;
  if (file) {
    const extension = file.name.includes('.') ? file.name.split('.').pop() : 'pdf';
    const path = `${id}/contrato.${extension}`;
    const [{ error: uploadError }, highlights] = await Promise.all([
      supabase.storage.from('contracts').upload(path, file, {
        contentType: file.type,
        upsert: true,
      }),
      extractHighlights(file),
    ]);
    if (uploadError) fail('Não foi possível enviar o arquivo do contrato.');
    filePath = path;
    extractedHighlights = highlights;
  }

  let distratoFilePath = existing.distrato_file_path;
  if (distratoFile) {
    const extension = distratoFile.name.includes('.') ? distratoFile.name.split('.').pop() : 'pdf';
    const path = `${id}/distrato.${extension}`;
    const { error: uploadError } = await supabase.storage.from('contracts').upload(path, distratoFile, {
      contentType: distratoFile.type,
      upsert: true,
    });
    if (uploadError) fail('Não foi possível enviar o arquivo do distrato.');
    distratoFilePath = path;
  }

  const { error: updateError } = await supabase
    .from('contracts')
    .update({
      title: fields.title,
      counterparty: fields.title,
      counterparty_cnpj: fields.counterpartyCnpj,
      contract_type: fields.contractType,
      contract_detail_type: fields.contractDetailType,
      start_date: fields.startDate,
      end_date: fields.endDate,
      renewal_notice_days: fields.renewalNoticeDays,
      total_amount_cents: fields.amountCents,
      is_variable_value: fields.isVariableValue,
      readjustment_index: fields.readjustmentIndex,
      readjustment_period_months: fields.readjustmentPeriodMonths,
      has_distrato: fields.hasDistrato,
      representative_name: fields.representativeName,
      contact_email: fields.contactEmail,
      contact_phone: fields.contactPhone,
      internal_code: fields.internalCode,
      department: fields.department,
      internal_manager_id: fields.internalManagerId,
      termination_reason: fields.terminationReason,
      alert_emails: fields.alertEmails,
      ...(file ? { extracted_highlights: extractedHighlights } : {}),
      notes: fields.notes || null,
      file_path: filePath,
      distrato_file_path: distratoFilePath,
    })
    .eq('id', id);

  if (updateError) fail('Não foi possível atualizar o contrato.');

  revalidatePath('/contratos');
  revalidatePath(`/contratos/${id}`);
  redirect(`/contratos/${id}`);
}

export async function updateContractStatus(formData: FormData) {
  await requireProfile();
  const supabase = await createServerSupabaseClient();

  const id = String(formData.get('id') ?? '');
  const statusValues = ['ativo', 'encerrado', 'cancelado'] as const;
  const status = String(formData.get('status') ?? '') as (typeof statusValues)[number];
  if (!id || !statusValues.includes(status)) {
    fail('Dados inválidos.');
  }

  const { error } = await supabase.from('contracts').update({ status }).eq('id', id);
  if (error) fail('Não foi possível atualizar o status do contrato.');

  revalidatePath('/contratos');
  revalidatePath(`/contratos/${id}`);
  redirect(`/contratos/${id}`);
}

export async function deleteContract(formData: FormData) {
  await requireRole('admin');
  const supabase = await createServerSupabaseClient();

  const id = String(formData.get('id') ?? '');
  if (!id) fail('Contrato inválido.');

  const { data: existing } = await supabase.from('contracts').select('file_path').eq('id', id).single();

  const { error } = await supabase.from('contracts').delete().eq('id', id);
  if (error) fail('Não foi possível excluir o contrato.');

  if (existing?.file_path) {
    await supabase.storage.from('contracts').remove([existing.file_path]);
  }

  revalidatePath('/contratos');
  redirect('/contratos');
}

const amendmentSchema = z.object({
  documentName: z.string(),
  description: z.string().trim().min(1, 'Resuma o aditivo.'),
  status: z.enum(['em_analise', 'assinado']),
  amendmentDate: z.string().min(1, 'Informe a data do aditivo.'),
});

export async function addAmendment(formData: FormData) {
  await requireProfile();
  const supabase = await createServerSupabaseClient();

  const contractId = String(formData.get('contractId') ?? '');
  if (!contractId) fail('Contrato inválido.');

  const parsed = amendmentSchema.safeParse({
    documentName: String(formData.get('documentName') ?? ''),
    description: String(formData.get('description') ?? ''),
    status: String(formData.get('status') ?? 'em_analise'),
    amendmentDate: String(formData.get('amendmentDate') ?? ''),
  });
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? 'Dados inválidos.');

  const file = extractPdfFile(formData, 'file', 'do aditivo');

  const { data: inserted, error } = await supabase
    .from('contract_amendments')
    .insert({
      contract_id: contractId,
      document_name: parsed.data.documentName.trim() || null,
      description: parsed.data.description,
      status: parsed.data.status,
      amendment_date: parsed.data.amendmentDate,
    })
    .select('id')
    .single();
  if (error || !inserted) fail('Não foi possível adicionar o aditivo.');

  if (file) {
    const extension = file.name.includes('.') ? file.name.split('.').pop() : 'pdf';
    const path = `${contractId}/aditivos/${inserted.id}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('contracts').upload(path, file, {
      contentType: file.type,
      upsert: true,
    });
    if (!uploadError) {
      await supabase.from('contract_amendments').update({ file_path: path }).eq('id', inserted.id);
    }
  }

  revalidatePath(`/contratos/${contractId}`);
  redirect(`/contratos/${contractId}`);
}

export async function updateAmendmentStatus(formData: FormData) {
  await requireProfile();
  const supabase = await createServerSupabaseClient();

  const amendmentId = String(formData.get('amendmentId') ?? '');
  const contractId = String(formData.get('contractId') ?? '');
  const statusValues = ['em_analise', 'assinado'] as const;
  const status = String(formData.get('status') ?? '') as (typeof statusValues)[number];
  if (!amendmentId || !contractId || !statusValues.includes(status)) {
    fail('Dados inválidos.');
  }

  const { error } = await supabase.from('contract_amendments').update({ status }).eq('id', amendmentId);
  if (error) fail('Não foi possível atualizar o status do aditivo.');

  revalidatePath(`/contratos/${contractId}`);
  redirect(`/contratos/${contractId}`);
}

export async function deleteAmendment(formData: FormData) {
  await requireProfile();
  const supabase = await createServerSupabaseClient();

  const amendmentId = String(formData.get('amendmentId') ?? '');
  const contractId = String(formData.get('contractId') ?? '');
  if (!amendmentId || !contractId) fail('Aditivo inválido.');

  const { data: existing } = await supabase
    .from('contract_amendments')
    .select('file_path')
    .eq('id', amendmentId)
    .single();

  const { error } = await supabase.from('contract_amendments').delete().eq('id', amendmentId);
  if (error) fail('Não foi possível excluir o aditivo.');

  if (existing?.file_path) {
    await supabase.storage.from('contracts').remove([existing.file_path]);
  }

  revalidatePath(`/contratos/${contractId}`);
  redirect(`/contratos/${contractId}`);
}
