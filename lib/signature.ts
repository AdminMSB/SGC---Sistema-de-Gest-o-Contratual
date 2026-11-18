import { createHash, randomBytes } from 'node:crypto';
import { MAX_SIGNERS, SIGNER_ROLES, type SignerRole } from './signature-limits';

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Token imprevisível do link de assinatura (256 bits). */
export function generateSignatureToken(): string {
  return randomBytes(32).toString('hex');
}

const SIGNATURE_DATE_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'America/Sao_Paulo',
});

export function formatSignatureDateTime(iso: string): string {
  return SIGNATURE_DATE_FORMAT.format(new Date(iso));
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SignerInput {
  name: string;
  email: string;
  role: SignerRole;
}

/** Valida a lista de signatários vinda do formulário; linhas totalmente vazias são ignoradas. */
export function parseSigners(
  names: string[],
  emails: string[],
  roles: string[] = [],
): { ok: true; signers: SignerInput[] } | { ok: false; error: string } {
  const signers: SignerInput[] = [];
  const total = Math.max(names.length, emails.length);
  for (let index = 0; index < total; index++) {
    const name = (names[index] ?? '').trim();
    const email = (emails[index] ?? '').trim().toLowerCase();
    if (!name && !email) continue;
    if (!name) return { ok: false, error: 'Informe o nome de todos os signatários.' };
    if (!EMAIL_PATTERN.test(email)) return { ok: false, error: `E-mail inválido para ${name}.` };
    const role = (roles[index] || 'contratante') as SignerRole;
    if (!SIGNER_ROLES.includes(role)) return { ok: false, error: `Papel inválido para ${name}.` };
    signers.push({ name, email, role });
  }
  if (signers.length === 0) return { ok: false, error: 'Informe ao menos um signatário.' };
  if (signers.length > MAX_SIGNERS) {
    return { ok: false, error: `No máximo ${MAX_SIGNERS} signatários por solicitação.` };
  }
  if (new Set(signers.map((signer) => signer.email)).size !== signers.length) {
    return { ok: false, error: 'Há e-mails repetidos entre os signatários.' };
  }
  return { ok: true, signers };
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
