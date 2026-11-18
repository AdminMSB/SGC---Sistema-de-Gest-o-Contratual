import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { allPermissions, buildPermissionMap, type Permission } from '@/lib/permissions';
import type { CurrentProfile, Role } from '@/types/domain';

/**
 * Retorna o perfil (profile + role) do usuário autenticado na requisição atual,
 * ou `null` se não houver sessão. Não redireciona — use `requireProfile` quando
 * a página exigir autenticação.
 */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();

  if (!profile) return null;

  // Administrador tem tudo; o gestor segue a matriz configurada em Configurações > Permissões.
  let permissions = allPermissions();
  if (profile.role !== 'admin') {
    const { data: rows } = await supabase.from('role_permissions').select('permission, allowed').eq('role', profile.role);
    permissions = buildPermissionMap(rows ?? []);
  }

  return {
    id: profile.id,
    fullName: profile.full_name,
    role: profile.role,
    active: profile.active ?? true,
    permissions,
  };
}

/** Garante autenticação; redireciona para /login se não houver sessão. */
export async function requireProfile(): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  // Usuário desativado com sessão ainda aberta: encerra a sessão e volta ao login.
  if (!profile.active) redirect('/api/auth/inativo');
  return profile;
}

/** Garante autenticação + um dos perfis informados; caso contrário, redireciona para /dashboard. */
export async function requireRole(...roles: Role[]): Promise<CurrentProfile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) redirect('/dashboard');
  return profile;
}

/** Garante a permissão (o Administrador sempre tem); caso contrário volta para a lista de contratos com aviso. */
export async function requirePermission(permission: Permission): Promise<CurrentProfile> {
  const profile = await requireProfile();
  if (!profile.permissions[permission]) {
    redirect(`/contratos?error=${encodeURIComponent('Você não tem permissão para esta ação.')}`);
  }
  return profile;
}
