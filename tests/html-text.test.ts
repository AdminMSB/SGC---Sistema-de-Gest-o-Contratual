import { describe, expect, it } from 'vitest';
import { htmlToText } from '@/lib/html-text';

describe('htmlToText', () => {
  it('converte parágrafos, links e entidades em texto puro', () => {
    const html =
      '<p>Olá, Ana &amp; Bia.</p><p><a href="https://x.com/assinar/abc" style="a:b">Revisar e assinar</a></p><p>Linha 1<br>Linha 2</p>';
    expect(htmlToText(html)).toBe('Olá, Ana & Bia.\n\nRevisar e assinar: https://x.com/assinar/abc\n\nLinha 1\nLinha 2');
  });
});
