import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { formatSignatureDateTime } from '@/lib/signature';
import { signerRoleLabel } from '@/lib/signature-limits';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signDocument } from './actions';
import { SignButton } from './sign-button';

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
          <form action={signDocument} className="flex max-w-lg flex-col gap-4">
            <input type="hidden" name="token" value={params.token} />
            <div>
              <Label htmlFor="signedName">Digite seu nome completo</Label>
              <Input id="signedName" name="signedName" required minLength={3} autoComplete="name" />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="accept" required className="mt-0.5" />
              <span>Li o documento e concordo com o seu conteúdo. Declaro que esta é a minha assinatura.</span>
            </label>
            <div>
              <SignButton />
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
