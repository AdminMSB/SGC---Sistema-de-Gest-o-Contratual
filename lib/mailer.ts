import 'server-only';
import nodemailer from 'nodemailer';
import { htmlToText } from '@/lib/html-text';

export interface MailConfig {
  provider: 'smtp' | 'gmail';
  from: string;
  /** Texto curto para mostrar na tela de diagnóstico (nunca inclui senha). */
  description: string;
}

/**
 * Lê a configuração de envio. Se `SMTP_HOST` existir, usa o servidor SMTP da empresa
 * (`SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` opcional); senão usa o Gmail
 * (`GMAIL_USER` + `GMAIL_APP_PASSWORD`, uma "Senha de app" do Google — ver README).
 * Devolve `null` quando nada está configurado.
 */
export function getMailConfig(): MailConfig | null {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  if (smtpHost && smtpUser && process.env.SMTP_PASSWORD) {
    return {
      provider: 'smtp',
      from: process.env.SMTP_FROM ?? smtpUser,
      description: `Servidor SMTP ${smtpHost}:${process.env.SMTP_PORT ?? '587'}`,
    };
  }
  const gmailUser = process.env.GMAIL_USER;
  if (gmailUser && process.env.GMAIL_APP_PASSWORD) {
    return { provider: 'gmail', from: gmailUser, description: 'Gmail (senha de app)' };
  }
  return null;
}

function createTransport() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
}

export interface SendMailResult {
  accepted: string[];
  response: string;
}

/**
 * Envia e-mail. Lança erro se o servidor recusar algum destinatário, para que quem chama não
 * marque como "enviado" algo que não saiu.
 */
export async function sendMail({
  to,
  subject,
  html,
  attachments,
}: {
  to: string[];
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
}): Promise<SendMailResult> {
  const config = getMailConfig();
  if (!config) {
    throw new Error('E-mail não configurado: defina GMAIL_USER/GMAIL_APP_PASSWORD ou SMTP_HOST/SMTP_USER/SMTP_PASSWORD.');
  }

  const info = await createTransport().sendMail({
    from: `SGC - Sistema de Gestão Contratual <${config.from}>`,
    to: to.join(', '),
    subject,
    html,
    text: htmlToText(html),
    attachments,
  });

  const rejected = (info.rejected ?? []).map(String);
  if (rejected.length > 0) {
    throw new Error(`Destinatário recusado pelo servidor de e-mail: ${rejected.join(', ')}`);
  }
  return { accepted: (info.accepted ?? []).map(String), response: String(info.response ?? '') };
}
