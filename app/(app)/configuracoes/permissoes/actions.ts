'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { PERMISSIONS } from '@/lib/permissions';

const BASE_PATH = '/configuracoes/permissoes';

/** Salva a matriz de permissões do Gestor (checkbox marcado = permitido). */
export async function savePermissions(formData: FormData): Promise<void> {
  await requireRole('admin');

  const supabase = await createServerSupabaseClient();
  const rows = PERMISSIONS.map((permission) => ({
    role: 'gestor' as const,
    permission,
    allowed: formData.get(permission) === 'on',
  }));

  const { error } = await supabase.from('role_permissions').upsert(rows, { onConflict: 'role,permission' });
  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Não foi possível salvar as permissões.')}`);
  }

  revalidatePath('/', 'layout');
  redirect(`${BASE_PATH}?ok=1`);
}
