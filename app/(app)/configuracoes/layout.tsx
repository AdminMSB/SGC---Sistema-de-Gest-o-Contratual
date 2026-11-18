import { requireRole } from '@/lib/auth';
import { SettingsTabs } from './settings-tabs';

export default async function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  await requireRole('admin');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Usuários, permissões e envio de e-mails.</p>
      </div>
      <SettingsTabs />
      {children}
    </div>
  );
}
