'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const BASE_PATH = '/configuracoes/gestores';

function redirectWithError(message: string): never {
  redirect(`${BASE_PATH}?error=${encodeURIComponent(message)}`);
}

const managerSchema = z.object({
  full_name: z.string().trim().min(1, 'Informe o nome completo.'),
});

export async function addManager(formData: FormData): Promise<void> {
  await requireRole('admin');

  const parsed = managerSchema.safeParse({
    full_name: String(formData.get('full_name') ?? ''),
  });
  if (!parsed.success) {
    redirectWithError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('contract_managers').insert({ full_name: parsed.data.full_name });
  if (error) redirectWithError('Não foi possível adicionar o gestor.');

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function deleteManager(formData: FormData): Promise<void> {
  await requireRole('admin');

  const id = String(formData.get('id') ?? '');
  if (!id) redirectWithError('Gestor inválido.');

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('contract_managers').delete().eq('id', id);
  if (error) redirectWithError('Não foi possível excluir o gestor.');

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}
