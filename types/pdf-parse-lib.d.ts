// A entrada padrão do pacote "pdf-parse" (index.js) tem um bloco de depuração que lê um
// arquivo de teste inexistente no bundle serverless da Vercel e quebra o import. Importamos
// direto o módulo interno, que não tem esse problema, mas ele não tem tipos publicados.
declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    text: string;
    numpages: number;
  }
  function pdfParse(data: Buffer): Promise<PdfParseResult>;
  export default pdfParse;
}
