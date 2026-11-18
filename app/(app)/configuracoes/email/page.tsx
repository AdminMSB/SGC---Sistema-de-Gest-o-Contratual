import { getMailConfig } from '@/lib/mailer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendTestEmail } from './actions';

export const dynamic = 'force-dynamic';

export default function EmailPage({ searchParams }: { searchParams: { error?: string; ok?: string } }) {
  const config = getMailConfig();

  return (
    <div className="flex flex-col gap-6">
      {searchParams.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {searchParams.error}
        </p>
      )}
      {searchParams.ok && (
        <p className="rounded-md border border-green-600/30 bg-green-600/10 px-4 py-3 text-sm font-medium text-green-700">
          {searchParams.ok}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Envio de e-mails</CardTitle>
          <CardDescription>
            Usado nos alertas de contratos e nos convites de assinatura digital.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {config ? (
            <div className="flex flex-col gap-1 text-sm">
              <p>
                <span className="text-muted-foreground">Enviando por:</span> <strong>{config.description}</strong>
              </p>
              <p>
                <span className="text-muted-foreground">Endereço do remetente:</span> <strong>{config.from}</strong>
              </p>
            </div>
          ) : (
            <p className="text-sm text-destructive">
              O envio de e-mails não está configurado. Defina as variáveis de ambiente na Vercel (veja o README).
            </p>
          )}

          <form action={sendTestEmail} className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
            <div>
              <Label htmlFor="test-to" className="text-xs">
                Enviar e-mail de teste para
              </Label>
              <Input id="test-to" name="to" type="email" required className="w-80" placeholder="nome@msbbrasil.com" />
            </div>
            <Button type="submit" disabled={!config}>
              Enviar teste
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Se o teste for aceito mas não chegar à caixa de entrada da pessoa, o e-mail foi filtrado do lado de quem
            recebe (Lixo eletrônico, quarentena ou bloqueio do TI). Nesse caso, peça ao TI para liberar o endereço do
            remetente acima.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
