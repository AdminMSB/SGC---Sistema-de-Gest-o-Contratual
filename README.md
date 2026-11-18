# SGC - Sistema de Gestão Contratual

Sistema web para gestão do ciclo de vida completo dos contratos da empresa (fornecedores/
prestadores de serviço, locação e demais serviços): cadastro com upload do PDF assinado,
extração automática de destaques do documento, aditivos, documentação de habilitação do fornecedor e
alerta automático por e-mail de vencimento/reajuste. Não há controle de pagamentos/parcelas —
isso é tratado em outro sistema.

## Stack

- **Next.js 14** (App Router) + **TypeScript** — front-end e back-end (Server Actions) em um
  único projeto.
- **Supabase**: Postgres (banco relacional), Auth (login), Storage (PDF dos contratos, aditivos). Autorização é aplicada via **Row Level Security** no Postgres, não apenas na
  aplicação.
- **Tailwind CSS** com componentes de UI próprios (sem dependência de biblioteca externa de
  componentes).
- **pdf-parse** para extrair o texto do PDF e reconhecer datas, valores, CNPJ, categoria e
  cláusulas notáveis por padrões de texto (regex, sem IA) — ver `lib/pdf-extract.ts`.
- **nodemailer** (Gmail SMTP) + **Vercel Cron** para o alerta automático de vencimento/reajuste.
- Testes: **Vitest** (extração de destaques do PDF, cálculo de datas de alerta).
- Deploy: **Vercel** (aplicação + cron job) + **Supabase** (banco/auth/storage).

## Perfis de acesso

| Perfil | Pode fazer |
|---|---|
| `gestor` | Vê **apenas os contratos em que é o "Gestor do contrato"** (regra aplicada no banco, com RLS). O que ele pode fazer neles é configurado pelo administrador em Configurações → Permissões: criar/editar, encerrar/reativar, documentos de habilitação, aditivos e assinatura digital. Nunca exclui contratos |
| `admin` | Vê todos os contratos, exclui contratos, gerencia usuários (cargo, departamento, telefone, ativo/inativo) e permissões, e acessa Configurações |

Usuário **inativo** não consegue entrar (o acesso de login é bloqueado no Supabase Auth). O sistema
exige ao menos um administrador ativo. Contratos sem "Gestor do contrato" só aparecem para o
administrador. As permissões do gestor são verificadas nas ações do servidor; a visibilidade dos
contratos e arquivos vale também no banco (migration `0036_users_permissions.sql`).

Sem fluxo de aprovação — é uma ferramenta interna para manter o controle centralizado dos
contratos, não um workflow de compras.

## Setup do projeto Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) (separado do projeto Supabase de
   qualquer outro sistema da empresa).
2. Em **Project Settings → API**, copie a `Project URL`, a `anon public key` e a
   `service_role key`.
3. Copie `.env.local.example` para `.env.local` e preencha essas variáveis (ver também
   "Alerta automático por e-mail" abaixo para as variáveis de e-mail).
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
   (usa a Auth Admin API com a `service_role key`). Quem deve aparecer como opção de "Gestor do
   contrato" precisa ser convidado com o papel **Gestor**.
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
3. Configure as variáveis de ambiente do projeto (mesmas do `.env.local`, incluindo as de
   e-mail — ver seção abaixo): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` (secret), `GMAIL_USER`, `GMAIL_APP_PASSWORD` (secret),
   `CRON_SECRET` (secret).
4. Deploy. Não é necessário nenhum build step além do padrão do Next.js (`next build`). O
   arquivo `vercel.json` já registra o cron job diário — nenhuma configuração extra é
   necessária na Vercel para isso além das variáveis de ambiente.
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
  api/cron/contract-alerts/  — job diário de alerta de vencimento/reajuste por e-mail
lib/
  supabase/                  — clients Supabase (server, browser, admin)
  pdf-extract.ts             — extração de destaques do PDF por padrões de texto (testável)
  pdf-text.ts                — leitura do texto bruto do PDF (pdf-parse)
  contract-alerts.ts         — cálculo de datas de alerta de reajuste (testável)
  mailer.ts                  — envio de e-mail via Gmail SMTP (nodemailer)
  auth.ts, format.ts, utils.ts
components/
  ui/                        — componentes de interface reutilizáveis
supabase/
  migrations/                — schema SQL, funções, RLS, storage (versionado)
  seed.sql                   — dados de exemplo
tests/                       — Vitest (extração de PDF, cálculo de datas de alerta)
```

## Extração automática de destaques do PDF

Ao escolher o arquivo do contrato no formulário (primeiro campo), o sistema lê o texto do PDF e
tenta preencher automaticamente (sem IA — por padrões de texto/regex, ver `lib/pdf-extract.ts`):
nome/contraparte, CNPJ, início/fim da vigência (aceita prazo em dias, meses ou anos), valor,
categoria, detalhamento e índice/período de reajuste. Os destaques também ficam salvos em
`contracts.extracted_highlights` e aparecem na tela de detalhe para consulta — sempre confira
contra o documento original, é uma conveniência, não uma leitura jurídica.

## Aditivos

- **Aditivos**: histórico de alterações/prorrogações formalizadas após a assinatura original,
  cada um com nome do documento, resumo, status (Em análise/Assinado) e PDF opcional
  (`contract_amendments`). A tela de detalhe mostra "Aditivo: Sim (N)/Não" com base na
  quantidade de registros — não é um campo próprio, é calculado a partir da lista.

## Histórico de status

Toda mudança de status (`ativo`/`encerrado`) é registrada automaticamente em
`contract_status_history` por um trigger no Postgres (não pela aplicação), com quem mudou e
quando — visível na tela de detalhe do contrato. "Expirado" não é um status salvo: é como um
contrato `ativo` aparece assim que o fim da vigência passa, até alguém marcar como encerrado.

## Documentação de habilitação e regularidade do fornecedor

Cada contrato tem uma checklist para qualificar o fornecedor, com upload (PDF, até 10MB) e
download de: Cartão CNPJ, contrato social/ato constitutivo, alvará, CND federal, CRF (FGTS),
CNDT, certidão estadual (ICMS) e municipal (ISS), além de "Outros documentos" avulsos. Cada
documento é escolhido numa lista ao anexar; só alvará, certidões e "outros" pedem data de validade. A situação é calculada: **Regular**, **Vencendo**
(30 dias ou menos) ou **Vencido**. O cron diário envia um e-mail agrupado por contrato (para os
"E-mails para alerta") listando os documentos vencendo/vencidos, repetido a cada 7 dias até a
atualização. Dados em `contract_documents`; arquivos em `contracts/{contract_id}/documentos/`.

## Valor variável

Contratos sem um valor total previsto (ex.: remuneração por comissão/uso) podem marcar "Valor
variável" em vez de preencher "Valor total do contrato" — o campo fica desabilitado e
`total_amount_cents` é gravado como `null`. O dashboard e a listagem tratam esse caso mostrando
"Variável" em vez de um valor em R$.

## Alerta automático por e-mail (vencimento, reajuste, pagamento e documentos)

Um cron job diário (`vercel.json` → `/api/cron/contract-alerts`, executado pela própria Vercel)
verifica todos os contratos ativos e envia e-mail para a lista em "E-mails para alerta de
vencimento/reajuste" quando:

- o contrato entra no prazo de **aviso prévio** antes do fim da vigência (mesma janela usada
  pela view `contracts_expiring`); ou
- a "Data prevista de reajuste" (preenchida manualmente no cadastro) cai dentro do prazo de
  aviso prévio.

E envia, para o **"E-mail financeiro"** (card "Alerta de faturamento"), um alerta com **10 dias corridos**
de antecedência de cada data de pagamento cadastrada — "Data do pagamento fixo" e "Data do
pagamento variável" são independentes, já que costumam cair em dias diferentes do mês.

Cada alerta só é enviado uma vez por ciclo — `contract_alert_log` registra o que já foi notificado e evita reenvio.

**Configuração necessária** (variáveis de ambiente):

1. **`GMAIL_USER`** / **`GMAIL_APP_PASSWORD`**: crie (ou use) uma conta Gmail dedicada ao envio,
   ative a verificação em duas etapas em [myaccount.google.com/security](https://myaccount.google.com/security)
   e gere uma "Senha de app" em [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   — **não** é a senha normal da conta, o Gmail bloqueia login SMTP com ela.
2. **`CRON_SECRET`**: uma string aleatória (ex.: `openssl rand -hex 32`) que protege o endpoint
   contra chamadas externas — a Vercel envia automaticamente esse valor como
   `Authorization: Bearer <CRON_SECRET>` nas chamadas que ela mesma dispara para rotas de cron.

O Gmail tem limite de ~500 e-mails/dia em contas pessoais, o que é bem mais que suficiente para
este uso. Se o volume de contratos crescer muito, considere migrar para um serviço transacional
dedicado (Resend, SendGrid) trocando apenas `lib/mailer.ts`.

## Assinatura digital (eletrônica simples)

Disponível na página de qualquer contrato com PDF anexado. O fluxo manual / gov.br continua valendo; esta é uma opção a mais.

1. Em "Assinatura digital", informe nome e e-mail de cada signatário e clique em "Enviar para assinatura". O sistema guarda uma cópia imutável do PDF e envia um link único e pessoal para cada pessoa (mesmo e-mail Gmail dos alertas).
2. O signatário abre o link (página pública `/assinar/<token>`, sem login), lê o PDF, digita o nome completo e confirma.
3. São registrados data/hora, IP, navegador e o hash SHA-256 do documento. Quando todos assinam, o sistema gera o PDF final com uma "Folha de assinaturas" ao fim, guarda no contrato ("Baixar PDF assinado") e envia a cópia por e-mail a todos.
4. **Ordem de assinatura:** segue a ordem dos papéis (Contratante → Contratada → Representante legal → Avalista/Fiador → Interveniente/Anuente → Testemunha → Outro). Quem tem o mesmo papel assina ao mesmo tempo; cada etapa só recebe o link por e-mail quando a anterior termina. Antes de assinar e antes de enviar, o sistema pede confirmação com data e hora. O PDF assinado também é arquivado na lista de documentos do contrato.
5. Dá para reenviar o link de quem ainda não assinou ou cancelar a solicitação (os links deixam de funcionar).

**Atenção:** é assinatura eletrônica *simples*. Tem validade como prova de manifestação de vontade, mas é mais fraca que certificado ICP-Brasil/gov.br; confirme com o jurídico quais contratos podem usá-la. Requer a migration `0034_signatures.sql`.

## Limitações conhecidas / próximos passos

- Não há testes end-to-end (E2E) automatizados — a validação da interface deve ser feita
  manualmente contra um projeto Supabase de desenvolvimento.
- O cron de alerta roda uma vez por dia (horário fixo em `vercel.json`); não há reenvio caso o
  envio de e-mail falhe naquele dia (tentará de novo no dia seguinte, já que o log só é gravado
  em caso de sucesso).
- Não há controle de pagamentos/parcelas neste sistema — é tratado em outro sistema da empresa.
