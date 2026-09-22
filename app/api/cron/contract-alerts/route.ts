import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { isWithinNoticeWindow } from '@/lib/contract-alerts';
import { sendMail } from '@/lib/mailer';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

const PAYMENT_ALERT_NOTICE_DAYS = 10;

type AlertType = 'vencimento' | 'reajuste' | 'nota_fiscal' | 'pagamento_fixo' | 'pagamento_variavel';

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
  const sent: { contractId: string; type: AlertType }[] = [];
  const failed: { contractId: string; type: AlertType; error: string }[] = [];
  const queryErrors: string[] = [];

  async function alreadySent(contractId: string, alertType: AlertType, windowDays: number) {
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

  async function notify(contractId: string, alertType: AlertType, recipients: string[], subject: string, html: string) {
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

  // Nota fiscal: lembrete ao FORNECEDOR (contact_email) para emitir/enviar a NF em dia(s)
  // fixos do mês. Dedup por "hoje" (não por janela de dias) — o próprio dia-do-mês já é o
  // gatilho, então cada dia configurado dispara seu próprio alerta no mês.
  const { data: invoiceReminders, error: invoiceReminderError } = await supabase
    .from('contracts')
    .select('id, title, contact_email, invoice_reminder_days')
    .eq('status', 'ativo')
    .not('invoice_reminder_days', 'is', null)
    .not('contact_email', 'is', null);
  if (invoiceReminderError) {
    queryErrors.push(`contracts (nota fiscal): ${invoiceReminderError.message}`);
    console.error('[contract-alerts] erro ao consultar contracts para nota fiscal:', invoiceReminderError);
  }

  const todayDayOfMonth = today.getDate();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

  async function alreadySentToday(contractId: string) {
    const { data, error } = await supabase
      .from('contract_alert_log')
      .select('id')
      .eq('contract_id', contractId)
      .eq('alert_type', 'nota_fiscal')
      .gte('sent_at', startOfToday)
      .limit(1);
    if (error) {
      queryErrors.push(`contract_alert_log (consulta nota fiscal): ${error.message}`);
      console.error('[contract-alerts] erro ao consultar contract_alert_log (nota fiscal):', error);
    }
    return (data?.length ?? 0) > 0;
  }

  for (const contract of invoiceReminders ?? []) {
    if (!contract.contact_email || !contract.invoice_reminder_days) continue;

    const reminderDays = contract.invoice_reminder_days
      .split(',')
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((value) => Number.isInteger(value));
    if (!reminderDays.includes(todayDayOfMonth)) continue;
    if (await alreadySentToday(contract.id)) continue;

    await notify(
      contract.id,
      'nota_fiscal',
      [contract.contact_email],
      `Lembrete de nota fiscal — Contrato "${contract.title}"`,
      `<p>Este é um lembrete automático para emissão/envio da nota fiscal referente ao contrato <strong>${contract.title}</strong>.</p>`,
    );
  }

  // Financeiro: alerta para o "E-mail financeiro" 10 dias corridos antes de cada data de
  // pagamento (fixo e variável são independentes, já que costumam cair em dias diferentes).
  const { data: financialContracts, error: financialError } = await supabase
    .from('contracts')
    .select('id, title, financial_email, fixed_payment_date, variable_payment_date')
    .eq('status', 'ativo')
    .not('financial_email', 'is', null);
  if (financialError) {
    queryErrors.push(`contracts (financeiro): ${financialError.message}`);
    console.error('[contract-alerts] erro ao consultar contracts para financeiro:', financialError);
  }

  const paymentDateFields = [
    { type: 'pagamento_fixo' as const, field: 'fixed_payment_date' as const, label: 'pagamento fixo' },
    { type: 'pagamento_variavel' as const, field: 'variable_payment_date' as const, label: 'pagamento variável' },
  ];

  for (const contract of financialContracts ?? []) {
    if (!contract.financial_email) continue;

    for (const { type, field, label } of paymentDateFields) {
      const paymentDate = contract[field];
      if (!paymentDate) continue;
      if (!isWithinNoticeWindow(paymentDate, PAYMENT_ALERT_NOTICE_DAYS, today)) continue;
      if (await alreadySent(contract.id, type, PAYMENT_ALERT_NOTICE_DAYS)) continue;

      await notify(
        contract.id,
        type,
        [contract.financial_email],
        `Contrato "${contract.title}" se aproxima da data de ${label}`,
        `<p>O contrato <strong>${contract.title}</strong> tem ${label} previsto para <strong>${formatDate(paymentDate)}</strong>.</p>`,
      );
    }
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
      invoiceReminderCount: invoiceReminders?.length ?? 0,
      financialCount: financialContracts?.length ?? 0,
    },
  });
}
