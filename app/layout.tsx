import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SGC - Sistema de Gestão Contratual',
  description: 'Cadastro, alertas de vencimento/renovação e controle de pagamentos dos contratos da empresa.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
