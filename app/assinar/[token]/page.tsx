import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { currentTurnSigners, formatSignatureDateTime } from '@/lib/signature';
import { signerRoleLabel } from '@/lib/signature-limits';
import { SignForm } from './sign-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{children}</CardDescription>
      </CardHeader>
    </Card>
  );
}

export default async function AssinarPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { error?: string };
}) {
  if (!/^[0-9a-f]{64}$/.test(params.token)) {
    return <Notice title="Link inválido">Verifique se o endereço foi copiado por inteiro do e-mail.</Notice>;
  }

  const admin = createAdminSupabaseClient();
  const { data: signer } = await admin
    .from('signature_signers')
    .select('id, name, role, request_id, signed_at')
    .eq('token', params.token)
    .single();
  if (!signer) {
    return <Notice title="Link inválido">Este link de assinatura não existe ou foi removido.</Notice>;
  }

  const { data: request } = await admin
    .from('signature_requests')
    .select('id, contract_id, status, document_path')
    .eq('id', signer.request_id)
    .single();
  if (!request) {
    return <Notice title="Link inválido">Esta solicitação de assinatura não existe mais.</Notice>;
  }

  const { data: contract } = await admin.from('contracts').select('title').eq('id', request.contract_id).single();
  const title = contract?.title ?? 'Documento';

  if (signer.signed_at) {
    return (
      <Notice title="Assinatura registrada">
        {signer.name}, sua assinatura em &quot;{title}&quot; foi registrada em {formatSignatureDateTime(signer.signed_at)}.
        {request.status === 'concluida'
          ? ' Todos os signatários já assinaram; a cópia final foi enviada por e-mail.'
          : ' Quando todos assinarem, a cópia final será enviada por e-mail.'}
      </Notice>
    );
  }

  if (request.status === 'cancelada') {
    return <Notice title="Solicitação cancelada">Esta solicitação de assinatura foi cancelada pelo remetente.</Notice>;
  }
  if (request.status === 'concluida') {
    return <Notice title="Solicitação encerrada">Este documento já foi finalizado.</Notice>;
  }

  const { data: siblings } = await admin
    .from('signature_signers')
    .select('id, name, role, signed_at')
    .eq('request_id', request.id);
  const turn = currentTurnSigners(siblings ?? []);
  if (!turn.some((sibling) => sibling.id === signer.id)) {
    return (
      <Notice title="Aguardando as assinaturas anteriores">
        {signer.name}, a assinatura segue uma ordem. Você receberá um novo e-mail com o link quando chegar a sua vez.
        Aguardando: {turn.map((sibling) => `${sibling.name}${signerRoleLabel(sibling.role) ? ` (${signerRoleLabel(sibling.role)})` : ''}`).join(', ')}.
      </Notice>
    );
  }

  const { data: signed } = await admin.storage.from('contracts').createSignedUrl(request.document_path, 60 * 60);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Olá, {signer.name}. Leia o documento abaixo e, se estiver de acordo, assine ao final da página.
          {signerRoleLabel(signer.role) && (
            <>
              {' '}
              Você assina como <strong>{signerRoleLabel(signer.role)}</strong>.
            </>
          )}
        </p>
      </div>

      {searchParams.error && <p className="text-sm text-destructive">{searchParams.error}</p>}

      {signed?.signedUrl ? (
        <iframe
          src={signed.signedUrl}
          title="Documento para assinatura (PDF)"
          className="h-[640px] w-full rounded-md border border-border"
        />
      ) : (
        <p className="text-sm text-destructive">Não foi possível exibir o documento. Recarregue a página.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Assinar eletronicamente</CardTitle>
          <CardDescription>
            Serão registrados seu nome, data e hora, endereço IP e a identificação (hash) do documento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignForm token={params.token} documentTitle={title} roleLabel={signerRoleLabel(signer.role)} />
        </CardContent>
      </Card>
    </div>
  );
}
