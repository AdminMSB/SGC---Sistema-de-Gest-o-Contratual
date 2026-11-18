import { NextResponse } from 'next/server';
import { requireProfile } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { appendSignatureSheet } from '@/lib/signature-pdf';
import { signerRoleLabel } from '@/lib/signature-limits';

export const dynamic = 'force-dynamic';

/** PDF do documento com a folha de assinaturas até o momento (parcial enquanto houver pendências). */
export async function GET(_request: Request, { params }: { params: { id: string; requestId: string } }) {
  await requireProfile();
  const supabase = await createServerSupabaseClient();

  const { data: signatureRequest } = await supabase
    .from('signature_requests')
    .select('id, contract_id, document_path, document_hash')
    .eq('id', params.requestId)
    .eq('contract_id', params.id)
    .single();
  if (!signatureRequest) return new NextResponse('Solicitação não encontrada.', { status: 404 });

  const [{ data: contract }, { data: signers }, { data: original }] = await Promise.all([
    supabase.from('contracts').select('title').eq('id', params.id).single(),
    supabase.from('signature_signers').select('*').eq('request_id', signatureRequest.id).order('created_at'),
    supabase.storage.from('contracts').download(signatureRequest.document_path),
  ]);
  if (!original) return new NextResponse('Não foi possível ler o documento.', { status: 500 });

  const all = signers ?? [];
  const pdf = await appendSignatureSheet(new Uint8Array(await original.arrayBuffer()), {
    contractTitle: contract?.title ?? 'Contrato',
    requestId: signatureRequest.id,
    documentHash: signatureRequest.document_hash,
    signers: all
      .filter((signer) => signer.signed_at)
      .map((signer) => ({
        name: signer.signed_name ?? signer.name,
        role: signerRoleLabel(signer.role),
        email: signer.email,
        signedAt: signer.signed_at as string,
        ip: signer.signed_ip,
      })),
    pending: all
      .filter((signer) => !signer.signed_at)
      .map((signer) => ({ name: signer.name, role: signerRoleLabel(signer.role), email: signer.email })),
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="documento-assinaturas-parcial.pdf"',
      'Cache-Control': 'private, no-store',
    },
  });
}
