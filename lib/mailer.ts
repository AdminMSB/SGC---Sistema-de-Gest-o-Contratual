import 'server-only';
import nodemailer from 'nodemailer';

/**
 * Envia e-mail via SMTP do Gmail. Requer uma "Senha de app" do Google (não a senha normal da
 * conta — o Gmail bloqueia login SMTP simples), gerada em myaccount.google.com/apppasswords.
 * Ver README para o passo a passo.
 */
export async function sendMail({ to, subject, html }: { to: string[]; subject: string; html: string }) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error('GMAIL_USER/GMAIL_APP_PASSWORD não configurados.');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `SGC - Sistema de Gestão Contratual <${user}>`,
    to: to.join(', '),
    subject,
    html,
  });
}
