# Lembretes do Bolão Mega da Virada 2026

## Escopo

Somente `/bolao` recebe labels brancos/maiores e o modal opcional. A página longa,
o contador existente, valores, WhatsApp, SW e inscrições autenticadas do aplicativo
não foram alterados. O worker `/bolao-sw.js` usa o escopo `/bolao`.
O convite opcional aparece aproximadamente 8 segundos após a entrada na página,
sem solicitar permissão nativa antes do clique de consentimento.

## Arquivos desta melhoria

- Alterados: `src/app/bolao/page.tsx`, `.env.example`.
- Interface: `src/components/bolao-reminder-prompt.tsx`.
- Worker/manifesto: `public/bolao-sw.js`, `public/bolao/manifest.webmanifest`.
- Backend: `src/lib/bolao/schedule.ts`, `src/lib/bolao/validation.ts`,
  `src/lib/bolao/server.ts`.
- APIs: `src/app/api/bolao/push-subscriptions/route.ts`,
  `src/app/api/bolao/reminders/route.ts`, `src/app/api/bolao/push-test/route.ts`.
- Banco/agenda: `supabase/migrations/202609030001_bolao_push_reminders.sql`,
  `vercel.json`.
- Testes: `tests/bolao-push.test.mjs`, `scripts/test-bolao-browser.mjs`.
- Instruções: `docs/bolao-reminders.md` (este arquivo).

## Configuração necessária

1. Aplicar no SQL Editor do Supabase a migration:
   `supabase/migrations/202609030001_bolao_push_reminders.sql`.
   São duas tabelas privadas, com RLS, sem acesso `anon`/`authenticated`, e uma RPC
   acessível apenas por `service_role` para reservar cada envio atomicamente.
2. Configurar na Vercel (Production e Preview de teste, conforme necessário):

   | Variável | Uso |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto já existente |
   | `SUPABASE_SERVICE_ROLE_KEY` | Chave secreta do Supabase; somente servidor |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Chave pública VAPID |
   | `VAPID_PRIVATE_KEY` | Chave privada VAPID; somente servidor |
   | `VAPID_SUBJECT` | Contato `mailto:` válido ou URL HTTPS |
   | `CRON_SECRET` | Segredo aleatório de no mínimo 32 caracteres |
   | `BOLAO_PUSH_TEST_SECRET` | Outro segredo aleatório de no mínimo 32 caracteres |
   | `BOLAO_REMINDERS_ENABLED` | `false` durante implantação/teste; `true` após confirmar push real |

   Reutilize o par VAPID existente, se já estiver em uso: **não rotacione as chaves
   do aplicativo**. Se não houver par, gere localmente com
   `npx web-push generate-vapid-keys`; não publique nem cole a chave privada em chats.
   Depois de configurar variáveis, redeploy na Vercel.
3. Em ambiente de desenvolvimento ou Preview, abra `/api/bolao/push-subscriptions`:
   `available: true` confirma configuração básica e acesso à tabela (não confirma
   entrega ao aparelho). Em Production, a inscrição pública também exige
   `BOLAO_REMINDERS_ENABLED=true`, para não prometer lembretes antes da ativação.
4. Faça o teste real abaixo **antes** de mudar `BOLAO_REMINDERS_ENABLED` para `true`.

Sem chaves/tabela, o contador segue funcionando e o modal explica que lembretes
estão temporariamente indisponíveis, sem pedir permissão nativa.

## Teste imediato, sem esperar a agenda

1. Primeiro use um deploy Vercel **Preview**, com as variáveis de teste configuradas
   e `BOLAO_REMINDERS_ENABLED=false`. Em Android/Chrome com HTTPS, abrir `/bolao`, aguardar 8 segundos e escolher
   `QUERO RECEBER LEMBRETES`. Autorizar o prompt nativo.
2. Confirmar `LEMBRETES ATIVADOS` e uma linha na tabela
   `bolao_push_subscriptions`. Copiar o `id` dessa inscrição de teste.
   O mesmo ID é retornado pelo POST de inscrição; não é necessário nome/telefone.
3. Enviar um POST com Bearer `BOLAO_PUSH_TEST_SECRET`:

   ```http
   POST https://<seu-deploy-preview>.vercel.app/api/bolao/push-test
   Authorization: Bearer <BOLAO_PUSH_TEST_SECRET>
   Content-Type: application/json

   {"subscriptionId":"<UUID da inscrição de teste>","testId":"android-primeiro-teste"}
   ```

4. `result: sent` significa aceitação pelo serviço Push, não confirmação de exibição.
   Verifique a notificação no celular com a aba fechada e toque: deve abrir `/bolao`.
5. Repetir o POST com o **mesmo** `testId` deve retornar `duplicate`, sem novo envio.
   Para outro teste intencional, usar um novo `testId`.
6. Testar `DESATIVAR LEMBRETES`: a inscrição/credenciais e seu histórico são
   removidos do backend, e o endpoint desse worker é cancelado no navegador.
7. Somente após confirmação no aparelho: configurar `BOLAO_REMINDERS_ENABLED=true`
   em Production e redeploy. Então também é possível testar uma inscrição de
   Production no mesmo endpoint em `https://cr-connect-ic3w.vercel.app`, sem esperar
   10 dias. Inscrições são específicas de cada origem; a inscrição de Preview não
   substitui a de Production. Não reutilizar IDs de testes como lembretes reais.

## Agenda e deduplicação

- Data alvo importada do contador existente: `2026-10-10T08:00:00-03:00`
  = `2026-10-10T11:00:00Z`.
- Marcos a cada dez dias, ancorados na abertura: 60/50/40/30/20/10 dias antes,
  depois 1 dia antes e abertura. Desde a publicação em setembro: 10/09, 20/09,
  30/09, 09/10 e 10/10, todos às 08:00 BRT.
- Não envia marcos anteriores à inscrição. Só considera o marco mais recente,
  evitando acumular lembretes atrasados. Para marcos periódicos atrasados, o texto
  usa os dias reais restantes. Após 36 horas da abertura, não há envios.
- `vercel.json`: um cron diário `0 11 * * *`, sempre em UTC.
- No Vercel Hobby, a execução pode ocorrer entre 08:00 e 08:59 BRT. Para precisão
  próxima de 08:00, usar plano Pro ou agendador externo confiável chamando o mesmo
  endpoint com `Authorization: Bearer <CRON_SECRET>`.
  Referências: https://vercel.com/docs/cron-jobs e
  https://vercel.com/docs/cron-jobs/usage-and-pricing .
- Chave única `(subscription_id, reminder_key)` e RPC atômica impedem duas
  invocações concorrentes de enviarem o mesmo marco. `tag` fixa no SW evita
  duplicidade visual. Rejeições 429/5xx podem ser tentadas novamente, até 3 vezes;
  timeout/resultado incerto não é repetido automaticamente. Isso prioriza não
  duplicar (uma falha ambígua pode significar um aviso perdido).
- 404/410 desativam inscrições inválidas. O cron não precisa receber nem registrar
  nome, telefone, CPF, IP ou user-agent. Endpoint e chaves de inscrição são privados.
- O serviço Push, o sistema e a conexão do aparelho podem atrasar ou impedir
  notificações. Não existe garantia de entrega exatamente no horário.

## Testes locais

`node --test tests/bolao-push.test.mjs`

`node scripts/test-bolao-browser.mjs` (com o servidor em `http://localhost:3010`)

O teste automatizado de consentimento usa permissões/subscriptions simuladas,
isoladas em um perfil temporário do Chrome. Ele não substitui o teste real Android
com Supabase, VAPID e o serviço Push. O teste do worker verifica conteúdo, destino,
tag, foco da aba existente e fallback seguro.

Validação realizada em 03/09/2026: 16 testes automatizados aprovados; build e
TypeScript aprovados; lint dos arquivos desta melhoria aprovado. Chrome em
320/360/390/768 px sem rolagem horizontal; labels em 390 px com 12,8 px, peso 800
e branco puro; modal, recusa, autorização simulada, opt-out, falta de suporte e
contagem pós-data aprovados. Uma notificação **local** do Service Worker foi
exibida/consultada no Chrome de teste, e a repetição da mesma tag manteve só uma.
O lint completo ainda aponta erros preexistentes em outras telas.

Após o ajuste para 8 segundos, a suíte de navegador passou contra a versão local
de produção (`next start`): convite medido em 8.050 ms, sem abrir antes de 8s.
Build, tipos, lint dirigido e os 16 testes unitários também passaram. O teste
continua simulando a inscrição remota; não comprova entrega Web Push em produção.

Pendentes antes de ativar Production: aplicação da migration no Supabase remoto,
configuração das variáveis e teste de **Push remoto real** no Android/Chrome. As
credenciais privadas e acesso administrativo não estavam disponíveis no ambiente
de desenvolvimento. Production permanece sem opt-in/envio enquanto a flag não
for explicitamente ativada.

Verificação posterior no painel da Vercel: `SUPABASE_SERVICE_ROLE_KEY`,
`VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` e
`NEXT_PUBLIC_SUPABASE_URL` já constam em Production e Preview. Os valores não
foram expostos nem substituídos. Ainda faltam `CRON_SECRET`,
`BOLAO_PUSH_TEST_SECRET` e a ativação controlada de `BOLAO_REMINDERS_ENABLED`.
O painel do Supabase solicitou login; a migration remota ainda não foi aplicada
nem verificada. Não ativar a flag antes de concluir o banco e o teste de Push real.

## Privacidade e navegadores

- Opt-in explícito, sem solicitação nativa no carregamento ou em `AGORA NÃO`.
- A recusa é guardada em `sessionStorage` para a mesma visita. Não há prompt após
  a abertura. Um botão discreto no final da página permite retomar a opção.
- Consentimento e token de gerenciamento ficam no navegador; o servidor guarda
  apenas o hash do token. O token não é uma chave VAPID.
- Android/Chrome: HTTPS e suporte a Service Worker/Push/Notifications necessários.
- iPhone/iPad: Web Push exige web app na Tela de Início e versão compatível
  (iOS/iPadOS 16.4+). Navegador incorporado do WhatsApp pode não oferecer Push.
- Preferências/permissão do sistema operacional prevalecem. A página sempre mantém
  o contador acessível quando Push não é suportado ou é recusado.
