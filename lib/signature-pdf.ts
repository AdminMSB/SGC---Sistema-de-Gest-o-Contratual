import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { formatSignatureDateTime } from './signature';

export interface SignatureSheetInfo {
  contractTitle: string;
  requestId: string;
  documentHash: string;
  signers: { name: string; role?: string | null; email: string; signedAt: string; ip: string | null }[];
}

// A fonte padrão do PDF só codifica Latin-1 + algumas pontuações; troca o resto por "?".
function safe(text: string): string {
  return text.replace(/[^\x20-\x7E -ÿ–—‘’“”•]/g, '?');
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = safe(text).split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Devolve o PDF original com uma "Folha de assinaturas" no final. Se o original não puder
 * ser lido (ex.: protegido), gera só a folha — o arquivo original continua guardado à parte.
 */
export async function appendSignatureSheet(
  original: Uint8Array | null,
  info: SignatureSheetInfo,
): Promise<Uint8Array> {
  let pdf: PDFDocument;
  try {
    pdf = original ? await PDFDocument.load(original, { ignoreEncryption: true }) : await PDFDocument.create();
  } catch {
    pdf = await PDFDocument.create();
  }

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 50;
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const maxWidth = pageWidth - margin * 2;

  let page: PDFPage = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };
  const draw = (text: string, opts: { size?: number; bold?: boolean; gray?: boolean; gap?: number } = {}) => {
    const size = opts.size ?? 10;
    const usedFont = opts.bold ? bold : font;
    for (const line of wrap(text, usedFont, size, maxWidth)) {
      ensureSpace(size + 4);
      page.drawText(line, {
        x: margin,
        y: y - size,
        size,
        font: usedFont,
        color: opts.gray ? rgb(0.35, 0.35, 0.35) : rgb(0.05, 0.07, 0.12),
      });
      y -= size + 4;
    }
    y -= opts.gap ?? 0;
  };

  draw('Folha de assinaturas', { size: 18, bold: true, gap: 6 });
  draw(`Documento: ${info.contractTitle}`, { size: 11, gap: 2 });
  draw(`Solicitação: ${info.requestId}`, { gray: true });
  draw(`SHA-256 do documento original: ${info.documentHash}`, { gray: true, gap: 14 });

  draw('Assinaturas registradas', { size: 12, bold: true, gap: 4 });
  for (const signer of info.signers) {
    ensureSpace(60);
    draw(signer.role ? `${signer.name} - ${signer.role}` : signer.name, { bold: true });
    draw(`E-mail: ${signer.email}`, { gray: true });
    draw(
      `Assinado em ${formatSignatureDateTime(signer.signedAt)} (horário de Brasília)${
        signer.ip ? ` - IP ${signer.ip}` : ''
      }`,
      { gray: true, gap: 8 },
    );
  }

  y -= 6;
  draw(
    'Assinaturas eletrônicas registradas pelo SGC - Sistema de Gestão Contratual. Cada signatário recebeu um link único por e-mail, conferiu o documento e confirmou com nome completo e aceite.',
    { size: 8, gray: true },
  );

  return pdf.save();
}
