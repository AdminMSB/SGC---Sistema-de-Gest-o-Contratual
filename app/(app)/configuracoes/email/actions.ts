'use server';

import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { sendMail } from '@/lib/mailer';

const BASE_PATH = '/configuracoes/email';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Envia um e-mail de teste e mostra a resposta do servidor, para diagnosticar problemas de entrega. */
export async function sendTestEmail(formData: FormData): Promise<void> {
  await requireRole('admin');

  const to = String(formData.get('to') ?? '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(to)) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Informe um e-mail válido.')}`);
  }

  try {
    const result = await sendMail({
      to: [to],
      subject: 'Teste de envio - SGC',
      html: '<p>Este é um e-mail de teste do <strong>SGC - Sistema de Gestão Contratual</strong>.</p><p>Se você recebeu, o envio de e-mails está funcionando para este endereço.</p>',
    });
    redirect(
      `${BASE_PATH}?ok=${encodeURIComponent(
        `E-mail aceito pelo servidor para ${result.accepted.join(', ')}. Resposta: ${result.response}. Se não chegar, peça para olhar o Lixo eletrônico/Spam.`,
      )}`,
    );
  } catch (error) {
    // `redirect` lança uma exceção especial do Next; deixa passar.
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
    const message = error instanceof Error ? error.message : 'Erro desconhecido.';
    redirect(`${BASE_PATH}?error=${encodeURIComponent(`Falha no envio: ${message}`)}`);
  }
}
