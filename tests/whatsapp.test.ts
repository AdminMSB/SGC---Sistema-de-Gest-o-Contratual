import { describe, expect, it } from 'vitest';
import { whatsappWebUrl } from '@/lib/whatsapp';

describe('whatsappWebUrl', () => {
  it('adiciona o código do Brasil a números com DDD', () => {
    expect(whatsappWebUrl('11 94527-3737')).toBe('https://web.whatsapp.com/send?phone=5511945273737');
    expect(whatsappWebUrl('(11) 3456-7890')).toBe('https://web.whatsapp.com/send?phone=551134567890');
  });

  it('mantém números que já têm código de país', () => {
    expect(whatsappWebUrl('+55 11 94527-3737')).toBe('https://web.whatsapp.com/send?phone=5511945273737');
  });

  it('retorna null para números curtos demais', () => {
    expect(whatsappWebUrl('3737-3737')).toBeNull();
    expect(whatsappWebUrl('')).toBeNull();
  });
});
