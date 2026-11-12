# CR CONNECT: Cloudflare D1 migration

## Completed 2026-11-12

- Dedicated D1 database `cr-connect` created in the existing Cloudflare account.
- Account ID: `407293a83ac133b0b64dae86fb16bd07`.
- Database ID: `a23f9414-4400-45d8-85e4-196e91781da7`.
- Applied `d1/migrations/0001_identity.sql` through the D1 API; verified schema remotely.
- Local validation: `python tests/d1-identity.test.py` (five integrity checks).
- No customer data, passwords, API tokens or email links have been imported.

## Important boundary

The Next.js application still uses Supabase. This branch is the D1 identity
foundation, not a working replacement for the existing application. No deployment
has been changed and no new login endpoint is exposed.

D1 has no PostgreSQL RLS. Every application operation must authorize its user,
verify the requested workshop membership, and scope reads AND writes to that
workshop. Composite foreign keys must prevent relationships across workshops.
The schema test checks membership storage, not application-level authorization.

## Remaining migration

1. Configure a Workers-compatible Next.js runtime and bind this database as `DB`.
2. Implement email-link authentication with a configured email delivery provider:
   generate random tokens server-side; store only token hashes; atomically consume
   short-lived single-use email tokens; rate-limit requests; create/revoke sessions
   through secure HttpOnly cookies; validate origin on mutations.
3. Translate all business migrations to SQLite, including constraints and indexes.
   Port PostgreSQL functions/triggers and RLS behavior to authorized server logic.
4. Replace browser-side Supabase database access with authenticated server APIs.
   Never accept SQL, arbitrary table names, or a client-provided user identity.
5. Migrate private attachments to R2 and authorize every upload/download.
6. Replace Realtime-dependent notifications/chat and port push/payment integrations.
7. Restore historical data only from a verified backup, then validate relationships.
8. Test separate workshops, expired/replayed login links, role restrictions,
   payments, stock, financial calculations, uploads, and app navigation end to end.

Do not replay the initial migration: it intentionally fails if tables already
exist. Check `cr_schema_migrations` before applying future changes. Identifiers
above are metadata, not credentials.
