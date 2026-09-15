import 'server-only';

/**
 * Extrai o texto de um PDF. Retorna string vazia (em vez de lançar) quando o arquivo não tem
 * camada de texto (ex.: PDF escaneado como imagem) — nesse caso simplesmente não há destaques
 * automáticos a mostrar, o que não deve impedir o cadastro/atualização do contrato.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    // Importa o módulo interno (não o pacote "pdf-parse" em si) — o index.js do pacote tem um
    // bloco de depuração que quebra ao rodar no ambiente serverless da Vercel.
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
    const data = await pdfParse(buffer);
    return data.text ?? '';
  } catch {
    return '';
  }
}
