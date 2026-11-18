'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireProfile } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAppBaseUrl } from '@/lib/app-url';
import { sendSignatureInvite } from '@/lib/signature-mail';
import { generateSignatureToken, parseSigners, sha256Hex } from '@/lib/signature';

function back(contractId: string, error?: string): never {
  const base = `/contratos/${contractId}`;
  redirect(error ? `${base}?error=${encodeURIComponent(error)}` : base);
}

/** Cria a solicitação: guarda uma cópia imutável do PDF, gera um link por signatário e envia os e-mails. */
export async function createSignatureRequest(formData: FormData): Promise<void> {
  const profile = await requireProfile();
  const contractId = String(formData.get('contractId') ?? '');
  const parsed = parseSigners(
    formData.getAll('signerName').map(String),
    formData.getAll('signerEmail').map(String),
  );
  if (!parsed.ok) back(contractId, parsed.error);

  const supabase = await createServerSupabaseClient();
  const { data: contract } = await supabase
    .from('contracts')
    .select('id, title, file_path')
    .eq('id', contractId)
    .single();
  if (!contract) back(contractId, 'Contrato não encontrado.');
  if (!contract.file_path) back(contractId, 'Anexe o PDF do contrato antes de solicitar assinaturas.');

  const { data: pending } = await supabase
    .from('signature_requests')
    .select('id')
    .eq('contract_id', contractId)
    .eq('status', 'pendente');
  if (pending && pending.length > 0) {
    back(contractId, 'Já existe uma solicitação de assinatura em andamento. Cancele-a para criar outra.');
  }

  const { data: original, error: downloadError } = await supabase.storage
    .from('contracts')
    .download(contract.file_path);
  if (downloadError || !original) back(contractId, 'Não foi possível ler o PDF do contrato.');
  const bytes = new Uint8Array(await original.arrayBuffer());

  const requestId = crypto.randomUUID();
  const documentPath = `${contractId}/assinatura-${requestId}/original.pdf`;
  const { error: uploadError } = await supabase.storage
    .from('contracts')
    .upload(documentPath, bytes, { contentType: 'application/pdf' });
  if (uploadError) back(contractId, 'Não foi possível guardar a cópia do documento para assinatura.');

  const { error: requestError } = await supabase.from('signature_requests').insert({
    id: requestId,
    contract_id: contractId,
    document_path: documentPath,
    document_hash: sha256Hex(bytes),
    created_by: profile.id,
  });
  if (requestError) back(contractId, 'Não foi possível criar a solicitação de assinatura.');

  const { data: signers, error: signersError } = await supabase
    .from('signature_signers')
    .insert(
      parsed.signers.map((signer) => ({
        request_id: requestId,
        name: signer.name,
        email: signer.email,
        token: generateSignatureToken(),
      })),
    )
    .select('id, name, email, token');
  if (signersError || !signers) back(contractId, 'Não foi possível registrar os signatários.');

  const baseUrl = getAppBaseUrl();
  const failures: string[] = [];
  for (const signer of signers) {
    try {
      await sendSignatureInvite({
        to: signer.email,
        signerName: signer.name,
        contractTitle: contract.title,
        link: `${baseUrl}/assinar/${signer.token}`,
      });
      await supabase
        .from('signature_signers')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', signer.id);
    } catch {
      failures.push(signer.email);
    }
  }

  revalidatePath(`/contratos/${contractId}`);
  back(
    contractId,
    failures.length > 0
      ? `Solicitação criada, mas o e-mail não foi enviado para: ${failures.join(', ')}. Use "Reenviar".`
      : undefined,
  );
}

export async function resendSignatureInvite(formData: FormData): Promise<void> {
  await requireProfile();
  const contractId = String(formData.get('contractId') ?? '');
  const signerId = String(formData.get('signerId') ?? '');

  const supabase = await createServerSupabaseClient();
  const { data: signer } = await supabase
    .from('signature_signers')
    .select('id, name, email, token, signed_at, request_id')
    .eq('id', signerId)
    .single();
  if (!signer || signer.signed_at) back(contractId, 'Signatário inválido ou já assinou.');

  const { data: request } = await supabase
    .from('signature_requests')
    .select('status, contract_id')
    .eq('id', signer.request_id)
    .single();
  if (!request || request.status !== 'pendente' || request.contract_id !== contractId) {
    back(contractId, 'A solicitação não está mais em andamento.');
  }
  const { data: contract } = await supabase.from('contracts').select('title').eq('id', contractId).single();

  try {
    await sendSignatureInvite({
      to: signer.email,
      signerName: signer.name,
      contractTitle: contract?.title ?? 'Contrato',
      link: `${getAppBaseUrl()}/assinar/${signer.token}`,
    });
    await supabase
      .from('signature_signers')
      .update({ email_sent_at: new Date().toISOString() })
      .eq('id', signer.id);
  } catch {
    back(contractId, `Não foi possível enviar o e-mail para ${signer.email}.`);
  }

  revalidatePath(`/contratos/${contractId}`);
  back(contractId);
}

export async function cancelSignatureRequest(formData: FormData): Promise<void> {
  await requireProfile();
  const contractId = String(formData.get('contractId') ?? '');
  const requestId = String(formData.get('requestId') ?? '');

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('signature_requests')
    .update({ status: 'cancelada' })
    .eq('id', requestId)
    .eq('status', 'pendente')
    .select('id');
  if (error || !data || data.length === 0) back(contractId, 'Não foi possível cancelar a solicitação.');

  revalidatePath(`/contratos/${contractId}`);
  back(contractId);
}
