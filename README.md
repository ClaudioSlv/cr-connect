# CR Connect

Fundação da plataforma de gestão e diagnóstico para oficinas, feita com Next.js, TypeScript e Supabase.

## Decisões da Fase 1

- **Next.js App Router:** interface responsiva e preparada para evoluir a PWA.
- **Supabase Auth:** login por link seguro enviado por e-mail.
- **Multi-oficina:** `workshops` e `workshop_users` isolam os dados por oficina.
- **Segurança:** RLS é ativado desde o início; toda tabela futura de dados de negócio deve ter `workshop_id` e políticas de acesso por oficina.
- **Internacionalização:** país, moeda, fuso e localidade já são campos configuráveis, sem regras brasileiras espalhadas pelo código.

Ainda não foram criados módulos de clientes, veículos, O.S., orçamento ou estoque — eles pertencem às próximas fases do documento-base.

## Configuração

1. Instale Node.js 20+ e habilite Corepack.
2. Copie `.env.example` para `.env.local` e preencha a URL e a Publishable Key do Supabase.
3. Execute `pnpm install` e depois `pnpm dev`.
4. Aplique `supabase/migrations/202608100001_initial_foundation.sql` no SQL Editor ou com a CLI do Supabase.
5. No Supabase, inclua `http://localhost:3000/auth/callback` em Authentication > URL Configuration.

## Pagamentos dos planos

O checkout dos planos Profissional (R$ 29,90) e CR SOS (R$ 44,90) usa a InfinitePay. Antes de publicar, configure `INFINITEPAY_HANDLE` nas variáveis de ambiente da Vercel com a sua InfiniteTag, sem o caractere `$` (por exemplo, `cr_connect`).

No App InfinitePay, habilite **Vendas > Checkout > Configurações > Habilitar Checkout Integrado**. O CR Connect cria o link de pagamento, recebe a confirmação pelo webhook e só então ativa o plano da oficina.

Os pagamentos são cobranças únicas: o CR Connect não cria recorrência automática na InfinitePay.

## Publicação no GitHub

O Git local é iniciado neste diretório. Crie um repositório vazio no GitHub e rode:

```bash
git remote add origin URL_DO_REPOSITORIO
git branch -M main
git push -u origin main
```

Não há chaves ou senhas no repositório; elas ficam exclusivamente em `.env.local`.
