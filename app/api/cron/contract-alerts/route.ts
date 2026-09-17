import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { isWithinNoticeWindow } from '@/lib/contract-alerts';
import { sendMail } from '@/lib/mailer';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * Roda uma vez por dia (ver vercel.json) e envia e-mail para `alert_emails` quando um contrato
 * entra no prazo de aviso prévio de vencimento, ou se aproxima da data de reajuste. Evita
 * reenviar o mesmo alerta repetidas vezes usando `contract_alert_log` como registro de controle
 * (um alerta não é reenviado se já houver um log do mesmo tipo nos últimos `renewal_notice_days`
 * dias para aquele contrato).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const today = new Date();
  const sent: { contractId: string; type: 'vencimento' | 'reajuste' }[] = [];
  const failed: { contractId: string; type: 'vencimento' | 'reajuste'; error: string }[] = [];
  const queryErrors: string[] = [];

  async function alreadySent(contractId: string, alertType: 'vencimento' | 'reajuste', windowDays: number) {
    const since = new Date(today.getTime() - windowDays * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('contract_alert_log')
      .select('id')
      .eq('contract_id', contractId)
      .eq('alert_type', alertType)
      .gte('sent_at', since)
      .limit(1);
    if (error) {
      queryErrors.push(`contract_alert_log (consulta): ${error.message}`);
      console.error('[contract-alerts] erro ao consultar contract_alert_log:', error);
    }
    return (data?.length ?? 0) > 0;
  }

  async function notify(
    contractId: string,
    alertType: 'vencimento' | 'reajuste',
    recipients: string[],
    subject: string,
    html: string,
  ) {
    try {
      await sendMail({ to: recipients, subject, html });
      const { error: logError } = await supabase
        .from('contract_alert_log')
        .insert({ contract_id: contractId, alert_type: alertType });
      if (logError) {
        queryErrors.push(`contract_alert_log (insert): ${logError.message}`);
        console.error('[contract-alerts] erro ao gravar contract_alert_log:', logError);
      }
      sent.push({ contractId, type: alertType });
      console.log(`[contract-alerts] enviado: contrato=${contractId} tipo=${alertType} para=${recipients.join(', ')}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed.push({ contractId, type: alertType, error: message });
      console.error(`[contract-alerts] falhou: contrato=${contractId} tipo=${alertType} erro=${message}`);
    }
  }

  // Vencimento: reaproveita a view contracts_expiring (já filtra status ativo e a janela de aviso).
  const { data: expiring, error: expiringError } = await supabase
    .from('contracts_expiring')
    .select('id, title, end_date, renewal_notice_days, alert_emails, days_until_expiration');
  if (expiringError) {
    queryErrors.push(`contracts_expiring: ${expiringError.message}`);
    console.error('[contract-alerts] erro ao consultar contracts_expiring:', expiringError);
  }

  for (const contract of expiring ?? []) {
    if (!contract.alert_emails || !contract.end_date) continue;
    if (await alreadySent(contract.id, 'vencimento', contract.renewal_notice_days)) continue;

    const recipients = contract.alert_emails.split(',').map((email) => email.trim()).filter(Boolean);
    if (recipients.length === 0) continue;

    await notify(
      contract.id,
      'vencimento',
      recipients,
      `Contrato "${contract.title}" vence em breve`,
      `<p>O contrato <strong>${contract.title}</strong> tem vigência até <strong>${formatDate(contract.end_date)}</strong> (${contract.days_until_expiration} dia(s)).</p>`,
    );
  }

  // Reajuste: data prevista é preenchida manualmente (não existe uma view pronta para isso).
  const { data: readjustable, error: readjustableError } = await supabase
    .from('contracts')
    .select('id, title, readjustment_date, renewal_notice_days, alert_emails')
    .eq('status', 'ativo')
    .not('readjustment_date', 'is', null)
    .not('alert_emails', 'is', null);
  if (readjustableError) {
    queryErrors.push(`contracts (reajuste): ${readjustableError.message}`);
    console.error('[contract-alerts] erro ao consultar contracts para reajuste:', readjustableError);
  }

  for (const contract of readjustable ?? []) {
    if (!contract.alert_emails || !contract.readjustment_date) continue;

    if (!isWithinNoticeWindow(contract.readjustment_date, contract.renewal_notice_days, today)) continue;
    if (await alreadySent(contract.id, 'reajuste', contract.renewal_notice_days)) continue;

    const recipients = contract.alert_emails.split(',').map((email) => email.trim()).filter(Boolean);
    if (recipients.length === 0) continue;

    await notify(
      contract.id,
      'reajuste',
      recipients,
      `Contrato "${contract.title}" se aproxima da data de reajuste`,
      `<p>O contrato <strong>${contract.title}</strong> tem reajuste previsto para <strong>${formatDate(contract.readjustment_date)}</strong>.</p>`,
    );
  }

  console.log(`[contract-alerts] execução concluída: ${sent.length} enviado(s), ${failed.length} falha(s)`);
  return NextResponse.json({
    sent,
    failed,
    queryErrors,
    debug: {
      today: today.toISOString(),
      expiringCount: expiring?.length ?? 0,
      expiring,
      readjustableCount: readjustable?.length ?? 0,
    },
  });
}
