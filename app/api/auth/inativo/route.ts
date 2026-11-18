import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Encerra a sessão de um usuário desativado e volta ao login com o aviso. */
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  const url = new URL('/login', request.url);
  url.searchParams.set('error', 'Seu acesso está inativo. Procure um administrador.');
  return NextResponse.redirect(url);
}
