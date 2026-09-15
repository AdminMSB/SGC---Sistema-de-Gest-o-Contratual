import 'server-only';

/**
 * Extrai o texto de um PDF. Retorna string vazia (em vez de lançar) quando o arquivo não tem
 * camada de texto (ex.: PDF escaneado como imagem) — nesse caso simplesmente não há destaques
 * automáticos a mostrar, o que não deve impedir o cadastro/atualização do contrato.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    return data.text ?? '';
  } catch {
    return '';
  }
}
