// Constantes seguras para Client Components (lib/signature.ts usa node:crypto).
export const MAX_SIGNERS = 10;

/**
 * Papéis na ordem de assinatura: as partes assinam primeiro, depois quem acompanha, e as
 * testemunhas por último. Quem tem o mesmo papel assina ao mesmo tempo.
 */
export const SIGNER_ROLES = [
  'contratante',
  'contratada',
  'representante_legal',
  'avalista',
  'anuente',
  'testemunha',
  'outro',
] as const;

export type SignerRole = (typeof SIGNER_ROLES)[number];

export const SIGNER_ROLE_LABELS: Record<SignerRole, string> = {
  contratante: 'Contratante',
  contratada: 'Contratada',
  representante_legal: 'Representante legal',
  avalista: 'Avalista/Fiador',
  anuente: 'Interveniente/Anuente',
  testemunha: 'Testemunha',
  outro: 'Outro',
};

export function signerRoleLabel(role: string | null): string | null {
  return role && role in SIGNER_ROLE_LABELS ? SIGNER_ROLE_LABELS[role as SignerRole] : null;
}

/** Posição do papel na ordem de assinatura (solicitações antigas, sem papel, assinam na primeira etapa). */
export function signerStep(role: string | null): number {
  const index = SIGNER_ROLES.indexOf(role as SignerRole);
  return index === -1 ? 0 : index;
}

/** Número da etapa (1, 2, 3…) de cada signatário, sem buracos entre os papéis usados. */
export function signingRank(roles: (string | null)[], role: string | null): number {
  const steps = [...new Set(roles.map(signerStep))].sort((a, b) => a - b);
  return steps.indexOf(signerStep(role)) + 1;
}
