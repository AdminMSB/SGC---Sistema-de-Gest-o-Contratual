import { createServerSupabaseClient } from '@/lib/supabase/server';
import { buildExpiryEvents, filterContracts, todayInBrazil, type ContractRow, type ReportFilters } from '@/lib/reports';

export interface ManagerOption {
  id: string;
  full_name: string;
}

/**
 * Carrega os dados do relatório com o client do usuário: o RLS do banco já limita o gestor aos
 * contratos em que ele é o responsável, e o administrador vê todos.
 */
export async function loadReportData(filters: ReportFilters) {
  const supabase = await createServerSupabaseClient();
  const [{ data: contracts }, { data: profiles }] = await Promise.all([
    supabase.from('contracts').select('*').order('title'),
    supabase.from('profiles').select('id, full_name').order('full_name'),
  ]);

  const all: ContractRow[] = contracts ?? [];
  const managers: ManagerOption[] = profiles ?? [];
  const nameById = new Map(managers.map((manager) => [manager.id, manager.full_name]));
  const managerName = (id: string | null) => (id ? (nameById.get(id) ?? '—') : '—');

  const today = todayInBrazil();
  return {
    today,
    managers,
    managerName,
    contracts: filters.tipo === 'contratos' ? filterContracts(all, filters) : [],
    events: filters.tipo === 'vencimentos' ? buildExpiryEvents(all, filters, today) : [],
  };
}
