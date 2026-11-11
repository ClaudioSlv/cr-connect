# Preparação da migração do CR Connect para Turso

## Estado

O banco libSQL do CR Connect foi criado pelo proprietário. As variáveis
`TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` foram cadastradas por ele na Vercel,
em Production. Os valores não foram acessados ou testados nesta preparação.

Esta etapa adiciona um cliente exclusivo do servidor, validação de configuração
e uma verificação de conexão somente leitura. Ela **não troca o banco usado
pelas telas**, não restaura dados remotos e não muda autenticação.

## Verificação de conexão

Em ambiente seguro com as duas variáveis disponíveis, execute:

```sh
node --env-file=.env.local scripts/check-turso.mjs
```

O comando executa somente `SELECT 1`. Não cria tabelas, não testa escrita e
não imprime URL, token ou detalhes de erros do provedor. Credenciais de
Production não devem ser copiadas para repositórios, mensagens ou capturas.

## Backup inspecionado em 11/11/2026

Arquivo: `db_cluster-28-10-2026@00-42-18.backup.gz`.
Formato confirmado: dump PostgreSQL em texto, comprimido com gzip.
Foi lido sem executar SQL. O conteúdo pessoal não faz parte do repositório.

| Tabela | Registros |
| --- | ---: |
| workshops | 1 |
| workshop_users | 1 |
| auth.users | 8 |
| profiles | 8 |
| clients | 10 |
| vehicles | 8 |
| budgets | 1 |
| budget_items | 1 |
| service_orders | 0 |
| service_order_items | 0 |
| products | 2 |
| financial_transactions | 4 |
| attachments | 0 |

Inventário completo sem dados pessoais:

```sh
python3 scripts/inspect-cr-backup.py /caminho/backup.gz
```

A contagem de `attachments` não comprova ausência de arquivos em outros
buckets. O backup SQL contém metadados de Storage; os bytes de imagens e
documentos exigem a cópia separada de Storage, ainda não inspecionada.

## Trabalho restante antes da troca

O código atual referencia Supabase em 68 arquivos. A migração precisa cobrir:

- Login por link de e-mail, validação de sessão e recuperação de acesso.
- Autorização por oficina hoje implementada com políticas RLS. O token Turso
  do servidor não representa o usuário; cada operação precisa validar acesso.
- Consultas do servidor e do navegador, funções SQL/RPC, transações,
  restrições, gatilhos e numeração automática.
- Conversão explícita de PostgreSQL para SQLite: UUID, datas, valores
  monetários, JSON, arrays e enums, com contagem e validação de relações.
- Links públicos de orçamento, atendimento e termos, além de webhooks e push.
- Armazenamento de arquivos, URLs assinadas e notificações em tempo real.

Não importar sessões, refresh tokens ou códigos de acesso antigos como
sessões válidas. Preservar a identidade dos usuários em um fluxo de migração
de autenticação separado. Validar isolamento entre oficinas antes de liberar
qualquer tela que use o cliente Turso.

O arquivo de 28/10 não contém ordens de serviço. Uma restauração fiel dessa
cópia não recupera dados criados depois dela; não anunciar recuperação integral.

Somente ativar a troca após testar login, acesso por oficina, gravação,
relações, arquivos e fluxos públicos. Não publicar esta preparação como se
fosse uma migração concluída.
