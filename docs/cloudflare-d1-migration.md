# CR CONNECT: Cloudflare D1 migration

## Current milestone — 2026-11-12

This branch adds a **partial D1 version**, separate from the legacy Supabase app.
It is not ready to replace the complete application. No Worker has been deployed
and the default GitHub branch has not been changed.

Implemented in D1 mode:

- Email-link login, explicit confirmation, logout and server-validated sessions.
- Atomic, single-use, 15-minute email tokens bound to the requesting browser.
- Seven-day HttpOnly, Secure (HTTPS), SameSite=Lax session cookies; only token
  hashes are stored. Links must open in the browser that requested them.
- Atomic email/IP rate limits, fixed configured origin, same-origin mutations,
  bounded JSON bodies and generic errors.
- Initial workshop onboarding, with unique creator ownership preventing races.
- Scoped client and vehicle CRUD, dashboard counts and timing-belt reminder fields.
- Membership/role checks on every data operation; compound foreign keys prevent
  a vehicle from referencing another workshop's customer.
- Workers build configuration, D1 binding and generated Cloudflare runtime types.
- No Supabase queries in the three converted pages. Unconverted app pages and
  legacy API routes are gated in D1 mode instead of silently falling back.

Legacy source remains available when `CR_BACKEND` is not `d1`.

## Infrastructure

- Account ID: `407293a83ac133b0b64dae86fb16bd07`.
- Database: `cr-connect` (`a23f9414-4400-45d8-85e4-196e91781da7`).
- Worker binding name: `DB`.
- Applied remotely: `0001_identity`, `0002_core`.
- No historical accounts, customer records, photos or credentials have been imported.

Do not replay either migration. They intentionally fail on duplicate tables or
columns. Check `cr_schema_migrations` before applying a migration.

## Required deployment configuration

`cloudflare.config.ts` selects D1 mode and the intended database. Before deploying,
configure `APP_ORIGIN` as the exact HTTPS application origin without a trailing
slash, plus `RESEND_API_KEY` and `AUTH_EMAIL_FROM` as Worker secrets. The sender
must be verified with the mail provider. Never use a public/frontend environment
variable for the API key. The account has no Cloudflare DNS zones, and Cloudflare's
Email Domain API returned unavailable for the account during inspection. No
sending provider or verified sender was configured or tested with a real email.

The prepared adapter uses the documented Resend `POST /emails` endpoint. It does
not silently report successful delivery when the provider is missing or fails.
A successful API request means the provider accepted the message, not that the
mailbox delivered it. Real sending and cross-device/browser usability still need
validation after credentials are configured.

Cloudflare's free/paid quotas apply independently to Workers, D1 and email delivery.
No paid plan or email subscription was purchased.

## Reproduce checks

```sh
npm ci
npm run typecheck
npm run test:d1
python tests/d1-identity.test.py
npm run build:vinext
cp .dev.vars.example .dev.vars
CR_BROWSER_TEST=/tmp/cr-connect-clean-preview npm run test:d1-preview
```

Use a **new empty directory** for each `CR_BROWSER_TEST` run; the preview script
creates schema and disposable fixtures only in that local database. It never
contacts the remote D1 API. Preview tests require `.dev.vars` with the documented
local origin and no email credentials, because they verify the missing-provider
failure state.

The API suite uses Miniflare's D1 implementation and covers session expiration,
link replay/concurrent consumption, origin checks, workshop/role isolation,
validation, CRUD, transactional onboarding, mail failures and rate limits.

The compiled Worker HTTP preview checks protected page redirects, rendered pages,
client/vehicle data flow, session revocation and honest email failure. Optional
`test:d1-browser` checks the same UI at mobile size using Playwright and a local
Chromium executable (`CHROMIUM_PATH`, default `/usr/bin/chromium`). Browser launch
was blocked by the execution environment's Unix-socket restrictions, so visual
and click-through verification has **not** passed in this environment.

Each list is capped at 1,000 records in this milestone; add pagination before
importing larger historical datasets. Vehicle-owner accounts and automatic
reminder delivery have not been ported; stored reminder dates do not imply a
notification will be sent.

## Remaining before full release

1. Configure and validate real email sending and confirm the final login method.
2. Port vehicle-owner onboarding and the customer portal.
3. Port service orders, budgets, terms, inventory, finance, team invitations,
   subscriptions, reports, notifications, chat and CR SOS. Translate PostgreSQL
   functions/triggers and their authorization rules; do not expose generic SQL.
4. Migrate private attachments and avatars to R2, with authorized upload/download.
5. Port push/payment integrations and their idempotent callbacks. No original
   Vercel bolão cron has been enabled on this Worker.
6. Restore historical data only from a verified backup, validate relationships,
   implement pagination and run complete cross-workshop/payment/UI tests.
7. Deploy a separate preview and validate it before switching production traffic.

D1 has no PostgreSQL RLS. Application authorization is mandatory on all future
reads and mutations, including internal/public-token routes. The Worker must use
D1 bindings; Cloudflare account API credentials must never reach a browser.
