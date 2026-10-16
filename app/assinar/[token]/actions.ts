'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { appendSignatureSheet } from '@/lib/signature-pdf';
import { sendSignedCopy } from '@/lib/signature-mail';
import { sha256Hex } from '@/lib/signature';

function backToSigning(token: string, error?: string): never {
  const base = `/assinar/${token}`;
  redirect(error ? `${base}?error=${encodeURIComponent(error)}` : base);
}

/** Registra a assinatura de um signatário pelo link único; quando o último assina, gera o PDF final. */
export async function signDocument(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '');
  const signedName = String(formData.get('signedName') ?? '').trim();
  const accepted = formData.get('accept') === 'on';

  if (!/^[0-9a-f]{64}$/.test(token)) backToSigning(token);
  if (signedName.length < 3) backToSigning(token, 'Digite seu nome completo para assinar.');
  if (!accepted) backToSigning(token, 'Marque a confirmação para assinar.');

  const admin = createAdminSupabaseClient();
  const { data: signer } = await admin
    .from('signature_signers')
    .select('id, request_id, signed_at')
    .eq('token', token)
    .single();
  if (!signer || signer.signed_at) backToSigning(token);

  const { data: request } = await admin
    .from('signature_requests')
    .select('id, contract_id, status, document_path, document_hash, created_by')
    .eq('id', signer.request_id)
    .single();
  if (!request || request.status !== 'pendente') backToSigning(token);

  // Confere que o documento guardado ainda é exatamente o que foi enviado para assinatura.
  const { data: original } = await admin.storage.from('contracts').download(request.document_path);
  if (!original) backToSigning(token, 'Não foi possível carregar o documento. Tente novamente.');
  const originalBytes = new Uint8Array(await original.arrayBuffer());
  if (sha256Hex(originalBytes) !== request.document_hash) {
    backToSigning(token, 'O documento foi alterado após o envio e não pode ser assinado.');
  }

  const requestHeaders = headers();
  const ip = (requestHeaders.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || null;
  const userAgent = requestHeaders.get('user-agent')?.slice(0, 300) ?? null;

  // `signed_at is null` evita assinatura dupla em cliques simultâneos.
  const { data: updated } = await admin
    .from('signature_signers')
    .update({
      signed_at: new Date().toISOString(),
      signed_name: signedName,
      signed_ip: ip,
      signed_user_agent: userAgent,
    })
    .eq('id', signer.id)
    .is('signed_at', null)
    .select('id');
  if (!updated || updated.length === 0) backToSigning(token);

  const { data: allSigners } = await admin
    .from('signature_signers')
    .select('name, email, signed_at, signed_name, signed_ip')
    .eq('request_id', request.id)
    .order('created_at');
  const everyoneSigned = (allSigners ?? []).length > 0 && (allSigners ?? []).every((row) => row.signed_at);

  if (everyoneSigned) {
    await finalizeRequest(request, allSigners ?? [], originalBytes);
  }

  backToSigning(token);
}

async function finalizeRequest(
  request: { id: string; contract_id: string; document_hash: string; created_by: string | null },
  signers: { name: string; email: string; signed_at: string | null; signed_name: string | null; signed_ip: string | null }[],
  originalBytes: Uint8Array,
) {
  const admin = createAdminSupabaseClient();
  const { data: contract } = await admin.from('contracts').select('title').eq('id', request.contract_id).single();
  const title = contract?.title ?? 'Contrato';

  const finalPdf = await appendSignatureSheet(originalBytes, {
    contractTitle: title,
    requestId: request.id,
    documentHash: request.document_hash,
    signers: signers.map((row) => ({
      name: row.signed_name ?? row.name,
      email: row.email,
      signedAt: row.signed_at ?? new Date().toISOString(),
      ip: row.signed_ip,
    })),
  });

  const signedPath = `${request.contract_id}/assinatura-${request.id}/assinado.pdf`;
  const { error: uploadError } = await admin.storage
    .from('contracts')
    .upload(signedPath, finalPdf, { contentType: 'application/pdf', upsert: true });
  if (uploadError) return;

  await admin
    .from('signature_requests')
    .update({ status: 'concluida', signed_document_path: signedPath, completed_at: new Date().toISOString() })
    .eq('id', request.id);

  const recipients = new Set(signers.map((row) => row.email));
  if (request.created_by) {
    const { data: creator } = await admin.auth.admin.getUserById(request.created_by);
    if (creator.user?.email) recipients.add(creator.user.email);
  }
  try {
    await sendSignedCopy({ to: [...recipients], contractTitle: title, pdf: Buffer.from(finalPdf) });
  } catch {
    // O PDF final já está guardado e disponível no contrato; falha de e-mail não desfaz a assinatura.
  }
}
