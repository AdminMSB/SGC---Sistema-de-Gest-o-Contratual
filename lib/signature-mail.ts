import 'server-only';
import { sendMail } from '@/lib/mailer';
import { escapeHtml } from '@/lib/signature';

export async function sendSignatureInvite(params: {
  to: string;
  signerName: string;
  contractTitle: string;
  link: string;
  roleLabel?: string | null;
}) {
  await sendMail({
    to: [params.to],
    subject: `Assinatura solicitada: ${params.contractTitle}`,
    html: `
      <p>Olá, ${escapeHtml(params.signerName)}.</p>
      <p>Você foi convidado(a) a assinar eletronicamente o documento <strong>${escapeHtml(params.contractTitle)}</strong>${
        params.roleLabel ? ` na qualidade de <strong>${escapeHtml(params.roleLabel)}</strong>` : ''
      }.</p>
      <p><a href="${params.link}" style="display:inline-block;padding:10px 18px;background:#1e3a5f;color:#fff;border-radius:6px;text-decoration:none">Revisar e assinar</a></p>
      <p style="color:#555;font-size:12px">Se o botão não abrir, copie este endereço no navegador:<br>${params.link}</p>
      <p style="color:#555;font-size:12px">O link é pessoal e intransferível. Se você não esperava este e-mail, ignore-o.</p>
    `,
  });
}

export async function sendSignedCopy(params: { to: string[]; contractTitle: string; pdf: Buffer }) {
  await sendMail({
    to: params.to,
    subject: `Documento assinado: ${params.contractTitle}`,
    html: `
      <p>Todos os signatários assinaram o documento <strong>${escapeHtml(params.contractTitle)}</strong>.</p>
      <p>Segue em anexo a cópia final, com a folha de assinaturas.</p>
    `,
    attachments: [{ filename: 'documento-assinado.pdf', content: params.pdf }],
  });
}
