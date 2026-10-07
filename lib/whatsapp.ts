/**
 * Link para abrir conversa no WhatsApp Web. Números com 10 ou 11 dígitos (DDD + telefone)
 * ganham o código do Brasil (55); números que já trazem código de país ficam como estão.
 * Retorna null se o telefone não tiver dígitos suficientes.
 */
export function whatsappWebUrl(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;

  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return `https://web.whatsapp.com/send?phone=${withCountry}`;
}
