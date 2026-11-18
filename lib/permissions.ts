// Permissões configuráveis do Gestor. O Administrador sempre tem todas. São exclusivos do
// Administrador (não aparecem na matriz): ver todos os contratos, excluir contratos, gerenciar
// usuários e acessar Configurações.

export const PERMISSIONS = [
  'create_edit_contract',
  'close_contract',
  'manage_documents',
  'manage_amendments',
  'send_signature',
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type PermissionMap = Record<Permission, boolean>;

export const PERMISSION_INFO: Record<Permission, { label: string; description: string }> = {
  create_edit_contract: {
    label: 'Criar e editar contratos',
    description: 'Cadastrar novos contratos e alterar os dados dos existentes.',
  },
  close_contract: {
    label: 'Encerrar e reativar contratos',
    description: 'Marcar como encerrado/inativo e voltar para ativo.',
  },
  manage_documents: {
    label: 'Gerenciar documentos de habilitação',
    description: 'Anexar e excluir documentos do fornecedor.',
  },
  manage_amendments: {
    label: 'Gerenciar aditivos',
    description: 'Incluir e excluir aditivos do contrato.',
  },
  send_signature: {
    label: 'Enviar para assinatura digital',
    description: 'Solicitar, reenviar e cancelar assinaturas eletrônicas.',
  },
};

export const DEFAULT_GESTOR_PERMISSIONS: PermissionMap = {
  create_edit_contract: true,
  close_contract: true,
  manage_documents: true,
  manage_amendments: true,
  send_signature: true,
};

export function allPermissions(): PermissionMap {
  return Object.fromEntries(PERMISSIONS.map((permission) => [permission, true])) as PermissionMap;
}

/** Monta o mapa de permissões a partir das linhas do banco; o que faltar usa o padrão do gestor. */
export function buildPermissionMap(rows: { permission: string; allowed: boolean }[]): PermissionMap {
  const map = { ...DEFAULT_GESTOR_PERMISSIONS };
  for (const row of rows) {
    if ((PERMISSIONS as readonly string[]).includes(row.permission)) {
      map[row.permission as Permission] = row.allowed;
    }
  }
  return map;
}
