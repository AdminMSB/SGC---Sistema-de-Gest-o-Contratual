import { NextResponse } from 'next/server';
import { getCurrentProfile } from '@/lib/auth';
import { extractTextFromPdf } from '@/lib/pdf-text';
import { deriveSuggestions, extractHighlightsFromText } from '@/lib/pdf-extract';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Extrai um preview de destaques do PDF (sem persistir nada) para pré-preencher o formulário
 * de cadastro assim que o usuário escolhe o arquivo, antes de salvar o contrato.
 */
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'O arquivo deve ser um PDF.' }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: 'O arquivo deve ter no máximo 10MB.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await extractTextFromPdf(buffer);
  if (!text.trim()) {
    return NextResponse.json({ highlights: null, suggestions: null });
  }

  const highlights = extractHighlightsFromText(text);
  const suggestions = deriveSuggestions(text, highlights);
  return NextResponse.json({ highlights, suggestions });
}
