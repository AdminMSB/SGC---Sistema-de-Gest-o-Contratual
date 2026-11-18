'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { DEPARTMENT_LABELS, type Role } from '@/types/domain';

const BASE_PATH = '/configuracoes/usuarios';
const ROLE_VALUES: Role[] = ['gestor', 'admin'];
// Praticamente permanente: o Supabase não tem "desativar", só banir por um período.
const BAN_FOREVER = '876000h';

function redirectWithError(message: string): never {
  redirect(`${BASE_PATH}?error=${encodeURIComponent(message)}`);
}

function isRole(value: string): value is Role {
  return ROLE_VALUES.includes(value as Role);
}

function isDepartment(value: string): boolean {
  return value === '' || value in DEPARTMENT_LABELS;
}

const profileFields = {
  job_title: z.string().max(100, 'Cargo muito longo.'),
  department: z.string().refine(isDepartment, { message: 'Selecione um departamento válido.' }),
};

function readProfileFields(formData: FormData) {
  return {
    job_title: String(formData.get('job_title') ?? '').trim(),
    department: String(formData.get('department') ?? '').trim(),
  };
}

const inviteSchema = z.object({
  full_name: z.string().min(1, 'Informe o nome completo.'),
  email: z.string().email('Informe um e-mail válido.'),
  role: z.string().refine(isRole, { message: 'Selecione um papel válido.' }),
  ...profileFields,
});

/** Convida um novo usuário por e-mail; o trigger `handle_new_user` cria a linha em `profiles`. */
export async function inviteUser(formData: FormData): Promise<void> {
  await requireRole('admin');

  const parsed = inviteSchema.safeParse({
    full_name: String(formData.get('full_name') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim(),
    role: String(formData.get('role') ?? '').trim(),
    ...readProfileFields(formData),
  });

  if (!parsed.success) {
    redirectWithError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
  }

  const admin = createAdminSupabaseClient();
  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: {
      full_name: parsed.data.full_name,
      role: parsed.data.role,
    },
  });

  if (error || !invited.user) {
    const message = /already|registered|existe/i.test(error?.message ?? '')
      ? 'Este e-mail já está cadastrado.'
      : 'Não foi possível enviar o convite.';
    redirectWithError(message);
  }

  // O trigger já criou o perfil; completa os demais campos do cadastro.
  const { error: profileError } = await admin
    .from('profiles')
    .update({
      job_title: parsed.data.job_title || null,
      department: parsed.data.department || null,
    })
    .eq('id', invited.user.id);
  if (profileError) {
    redirectWithError('Convite enviado, mas não foi possível salvar cargo/departamento. Edite o usuário.');
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

const userUpdateSchema = z.object({
  full_name: z.string().min(1, 'Informe o nome completo.'),
  role: z.string().refine(isRole, { message: 'Selecione um papel válido.' }),
  active: z.enum(['true', 'false']),
  ...profileFields,
});

/**
 * Atualiza cadastro, papel e situação (ativo/inativo) de um usuário. Restrito a `admin` — a policy
 * `profiles_update` do Postgres já bloqueia isso para não-admins, mas validamos aqui também para
 * dar uma mensagem amigável em vez de deixar a query falhar silenciosamente.
 */
export async function updateUser(formData: FormData): Promise<void> {
  const current = await requireRole('admin');

  const userId = String(formData.get('user_id') ?? '').trim();
  const parsed = userUpdateSchema.safeParse({
    full_name: String(formData.get('full_name') ?? '').trim(),
    role: String(formData.get('role') ?? '').trim(),
    active: String(formData.get('active') ?? 'true').trim(),
    ...readProfileFields(formData),
  });

  if (!userId) redirectWithError('Usuário inválido.');
  if (!parsed.success) {
    redirectWithError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
  }

  const active = parsed.data.active === 'true';
  const role = parsed.data.role as Role;
  const supabase = await createServerSupabaseClient();

  const { data: target } = await supabase.from('profiles').select('role, active').eq('id', userId).single();
  if (!target) redirectWithError('Usuário não encontrado.');

  if (userId === current.id && !active) {
    redirectWithError('Você não pode desativar o seu próprio acesso.');
  }

  // Nunca deixar o sistema sem nenhum administrador ativo.
  const losesAdmin = target.role === 'admin' && target.active !== false && (role !== 'admin' || !active);
  if (losesAdmin) {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .eq('active', true)
      .neq('id', userId);
    if (!admins || admins.length === 0) {
      redirectWithError('É preciso manter ao menos um administrador ativo.');
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.full_name,
      role,
      active,
      job_title: parsed.data.job_title || null,
      department: parsed.data.department || null,
    })
    .eq('id', userId)
    .select('id');

  if (error || !data || data.length === 0) {
    redirectWithError('Não foi possível atualizar o usuário.');
  }

  // Desativar de verdade: impede novos logins e renovação de sessão.
  if ((target.active !== false) !== active) {
    const admin = createAdminSupabaseClient();
    const { error: banError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: active ? 'none' : BAN_FOREVER,
    });
    if (banError) {
      redirectWithError('Dados salvos, mas não foi possível alterar o acesso de login deste usuário.');
    }
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}
