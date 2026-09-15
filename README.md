# SGC - Sistema de Gestão Contratual

Sistema web para gestão do ciclo de vida completo dos contratos da empresa (fornecedores/
prestadores de serviço, locação e demais serviços): cadastro com upload do PDF assinado,
extração automática de destaques do documento, aditivos, distrato, alertas de vencimento/
renovação e histórico de status. Não há controle de pagamentos/parcelas — isso é tratado em
outro sistema.

## Stack

- **Next.js 14** (App Router) + **TypeScript** — front-end e back-end (Server Actions) em um
  único projeto.
- **Supabase**: Postgres (banco relacional), Auth (login), Storage (PDF dos contratos, aditivos
  e distratos). Autorização é aplicada via **Row Level Security** no Postgres, não apenas na
  aplicação.
- **Tailwind CSS** com componentes de UI próprios (sem dependência de biblioteca externa de
  componentes).
- **pdf-parse** para extrair o texto do PDF e reconhecer datas, valores, CNPJ, categoria e
  cláusulas notáveis por padrões de texto (regex, sem IA) — ver `lib/pdf-extract.ts`.
- Testes: **Vitest** (extração de destaques do PDF).
- Deploy: **Vercel** (aplicação) + **Supabase** (banco/auth/storage).

## Perfis de acesso

| Perfil | Pode fazer |
|---|---|
| `membro` | Cadastrar, editar e acompanhar contratos, aditivos e distratos |
| `admin` | Tudo do membro + excluir contratos + gerenciar usuários e papéis |

Sem fluxo de aprovação — é uma ferramenta interna para manter o controle centralizado dos
contratos, não um workflow de compras.

## Setup do projeto Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) (separado do projeto Supabase de
   qualquer outro sistema da empresa).
2. Em **Project Settings → API**, copie a `Project URL`, a `anon public key` e a
   `service_role key`.
3. Copie `.env.local.example` para `.env.local` e preencha essas três variáveis.
4. Aplique as migrations (schema, funções, RLS e bucket de storage) — duas opções:
   - **Via Supabase CLI** (recomendado): `npx supabase login`, `npx supabase link --project-ref <seu-project-ref>`,
     depois `npx supabase db push`. Isso aplica tudo em `supabase/migrations/*.sql` em ordem.
   - **Via SQL Editor do painel Supabase**: cole o conteúdo de cada arquivo em
     `supabase/migrations/` na ordem numérica e execute.
5. (Opcional) Popule dados de exemplo (contratos com vencimentos próximos, para ver os alertas
   funcionando) executando `supabase/seed.sql` no SQL Editor.
6. Crie o primeiro usuário **admin**: no painel Supabase, vá em **Authentication → Users → Add
   user**, marque "Auto Confirm User", e em **User Metadata** (JSON) informe:
   ```json
   { "full_name": "Seu Nome", "role": "admin" }
   ```
   O trigger `handle_new_user` cria automaticamente a linha em `profiles` com esse papel. Os
   demais usuários podem ser convidados depois pela própria tela **Configurações → Usuários**
   (usa a Auth Admin API com a `service_role key`).
7. No bucket de Storage (`contracts`, criado pela migration `0004_storage.sql`), nada mais
   precisa ser feito manualmente — a política de acesso já é aplicada via SQL.

## Rodando localmente

Requer **Node.js 18.18+**.

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`. Rode os testes com:

```bash
npm run test
```

## Deploy

1. Suba o repositório para o GitHub/GitLab.
2. No [Vercel](https://vercel.com), importe o repositório.
3. Configure as variáveis de ambiente do projeto (mesmas do `.env.local`):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   (esta última marcada como *sensitive*/secret).
4. Deploy. Não é necessário nenhum build step além do padrão do Next.js (`next build`).
5. No painel do Supabase, em **Authentication → URL Configuration**, adicione a URL de produção
   da Vercel em *Site URL* e *Redirect URLs*.

## Estrutura do projeto

```
app/
  (auth)/login/              — tela de login
  (app)/dashboard/           — indicadores e alertas de vencimento
  (app)/contratos/           — lista, cadastro/edição, upload do PDF
  (app)/contratos/[id]/      — detalhe: dados do contrato, aditivos, histórico de status
  (app)/configuracoes/usuarios/ — gestão de usuários e papéis (admin)
  api/extract-pdf/           — preview da extração de destaques do PDF (usado pelo formulário)
lib/
  supabase/                  — clients Supabase (server, browser, admin)
  pdf-extract.ts             — extração de destaques do PDF por padrões de texto (testável)
  pdf-text.ts                — leitura do texto bruto do PDF (pdf-parse)
  auth.ts, format.ts, utils.ts
components/
  ui/                        — componentes de interface reutilizáveis
supabase/
  migrations/                — schema SQL, funções, RLS, storage (versionado)
  seed.sql                   — dados de exemplo
tests/                       — Vitest (extração de destaques do PDF)
```

## Extração automática de destaques do PDF

Ao escolher o arquivo do contrato no formulário, o sistema lê o texto do PDF e tenta preencher
automaticamente (sem IA — por padrões de texto/regex, ver `lib/pdf-extract.ts`): nome/contraparte,
CNPJ, início/fim da vigência (aceita prazo em dias, meses ou anos), valor, categoria,
detalhamento e índice/período de reajuste. Os destaques também ficam salvos em
`contracts.extracted_highlights` e aparecem na tela de detalhe para consulta — sempre confira
contra o documento original, é uma conveniência, não uma leitura jurídica.

## Aditivos e distrato

- **Aditivos**: histórico de alterações/prorrogações formalizadas após a assinatura original,
  cada um com data, descrição e PDF opcional (`contract_amendments`).
- **Distrato**: flag "Contrato com distrato" + upload do documento de distrato, independente do
  PDF do contrato original.

## Histórico de status

Toda mudança de status (`ativo`/`encerrado`/`cancelado`) é registrada automaticamente em
`contract_status_history` por um trigger no Postgres (não pela aplicação), com quem mudou e
quando — visível na tela de detalhe do contrato.

## Alertas de vencimento/renovação

O dashboard lista os contratos ativos cujo fim de vigência está dentro do prazo de aviso
configurado em cada contrato (campo "Avisar com quantos dias de antecedência"). Isso é resolvido
por uma view no Postgres (`contracts_expiring`), sem necessidade de um job agendado.

O campo "E-mails para alerta de vencimento/renovação" apenas armazena a lista de destinatários;
o envio automático de e-mail não está implementado (poderia ser feito via Supabase Edge
Functions + `pg_cron`, se necessário).

## Limitações conhecidas / próximos passos

- Não há testes end-to-end (E2E) automatizados — a validação da interface deve ser feita
  manualmente contra um projeto Supabase de desenvolvimento.
- Não há envio automático de e-mail para os alertas de vencimento nem para a lista de
  "E-mails para alerta" (hoje são só visuais, no dashboard/detalhe do contrato).
- Não há controle de pagamentos/parcelas neste sistema — é tratado em outro sistema da empresa.
