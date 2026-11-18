import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GESTOR_PERMISSIONS,
  PERMISSIONS,
  allPermissions,
  buildPermissionMap,
} from '@/lib/permissions';

describe('permissões', () => {
  it('administrador tem todas as permissões', () => {
    const map = allPermissions();
    expect(PERMISSIONS.every((permission) => map[permission])).toBe(true);
  });

  it('sem linhas no banco, o gestor usa o padrão', () => {
    const map = buildPermissionMap([]);
    expect(map).toEqual(DEFAULT_GESTOR_PERMISSIONS);
    expect(map.create_edit_contract).toBe(true);
  });

  it('aplica o que está salvo e ignora permissões desconhecidas', () => {
    const map = buildPermissionMap([
      { permission: 'close_contract', allowed: false },
      { permission: 'send_signature', allowed: false },
      { permission: 'inexistente', allowed: true },
    ]);
    expect(map.close_contract).toBe(false);
    expect(map.send_signature).toBe(false);
    expect('inexistente' in map).toBe(false);
  });
});
