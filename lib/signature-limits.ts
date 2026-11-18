// Constantes seguras para Client Components (lib/signature.ts usa node:crypto).
export const MAX_SIGNERS = 10;

export const SIGNER_ROLES = [
  'contratante',
  'contratada',
  'testemunha',
  'avalista',
  'representante_legal',
  'anuente',
  'outro',
] as const;

export type SignerRole = (typeof SIGNER_ROLES)[number];

export const SIGNER_ROLE_LABELS: Record<SignerRole, string> = {
  contratante: 'Contratante',
  contratada: 'Contratada',
  testemunha: 'Testemunha',
  avalista: 'Avalista/Fiador',
  representante_legal: 'Representante legal',
  anuente: 'Interveniente/Anuente',
  outro: 'Outro',
};

export function signerRoleLabel(role: string | null): string | null {
  return role && role in SIGNER_ROLE_LABELS ? SIGNER_ROLE_LABELS[role as SignerRole] : null;
}
