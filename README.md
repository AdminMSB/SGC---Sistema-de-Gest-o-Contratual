# Controle de Contratos

Sistema web para controlar todos os contratos da empresa (fornecedores/prestadores de serviço,
locação e demais serviços): cadastro com upload do PDF assinado, alertas de vencimento/renovação
e controle de valores/pagamentos.

## Stack

- **Next.js 14** (App Router) + **TypeScript** — front-end e back-end (Server Actions) em um
  único projeto.
- **Supabase**: Postgres (banco relacional), Auth (login), Storage (PDF dos contratos).
  Autorização é aplicada via **Row Level Security** no Postgres, não apenas na aplicação.
- **Tailwind CSS** com componentes de UI próprios (sem dependência de biblioteca externa de
  componentes).
- **date-fns** para o cálculo do cronograma de pagamentos (parcelas mensais/trimestrais/
  semestrais/anuais).
- Testes: **Vitest** (geração do cronograma de pagamentos).
- Deploy: **Vercel** (aplicação) + **Supabase** (banco/auth/storage).

## Perfis de acesso

| Perfil | Pode fazer |
|---|---|
| `membro` | Cadastrar, editar e acompanhar contratos e pagamentos |
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
     `supabase/migrations/` na ordem numérica (0001, 0002, 0003, 0004) e execute.
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
  (app)/contratos/[id]/      — detalhe: dados do contrato, status, cronograma de pagamentos
  (app)/configuracoes/usuarios/ — gestão de usuários e papéis (admin)
lib/
  supabase/                  — clients Supabase (server, browser, admin)
  contracts.ts               — geração do cronograma de pagamentos (testável isoladamente)
  auth.ts, format.ts, utils.ts
components/
  ui/                        — componentes de interface reutilizáveis
supabase/
  migrations/                — schema SQL, funções, RLS, storage (versionado)
  seed.sql                   — dados de exemplo
tests/                       — Vitest (geração do cronograma de pagamentos)
```

## Como funciona o cronograma de pagamentos

Ao cadastrar um contrato, as parcelas de `contract_payments` são geradas automaticamente a
partir de início/fim da vigência e da frequência de pagamento (`lib/contracts.ts`):

- **Mensal/trimestral/semestral/anual**: uma parcela a cada intervalo, do início ao fim da
  vigência.
- **Pagamento único**: uma parcela só, na data de início.
- **Outro** ou contrato **sem data de término** (prazo indeterminado): nenhuma parcela é gerada
  automaticamente — lance as parcelas manualmente na tela do contrato.

Editar um contrato já criado **não** regenera o cronograma (evita apagar pagamentos já
confirmados); ajuste as parcelas manualmente na tela de detalhe quando necessário.

Uma parcela pendente com vencimento no passado aparece como "Atrasado" automaticamente (não é
um status gravado no banco, é calculado na exibição — `paymentEffectiveStatus` em
`lib/contracts.ts`).

## Alertas de vencimento/renovação

O dashboard lista os contratos ativos cujo fim de vigência está dentro do prazo de aviso
configurado em cada contrato (campo "Avisar com quantos dias de antecedência"). Isso é resolvido
por uma view no Postgres (`contracts_expiring`), sem necessidade de um job agendado.

## Limitações conhecidas / próximos passos

- Não há testes end-to-end (E2E) automatizados — a validação da interface deve ser feita
  manualmente contra um projeto Supabase de desenvolvimento.
- Não há notificação por e-mail para os alertas de vencimento (hoje são só visuais, no
  dashboard) — pode ser adicionado via Supabase Edge Functions + `pg_cron`, se necessário.
- O valor "mensal comprometido" do dashboard soma apenas contratos com frequência de pagamento
  mensal; contratos anuais/trimestrais não são normalizados para um equivalente mensal.
