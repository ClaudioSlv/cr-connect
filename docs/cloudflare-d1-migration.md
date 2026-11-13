# CR Connect on Cloudflare D1

## Current milestone — 2026-11-13

Published application: https://cr-connect.claudio1748.workers.dev
Source branch: `migration/cloudflare-d1`; legacy default branch unchanged.
The old database was deleted; no historical data was imported.

Available in D1 mode:

- Password registration/login, logout and one-time recovery codes. Password hashes
  use PBKDF2 plus the existing private Worker pepper; sessions use secure cookies.
- Workshop onboarding, customers, vehicles and preventive-maintenance fields.
- Labor service catalog with price ranges, hourly rates and percentage adjustments.
- Budgets with service/part items, discounts and payment terms; the office records
  the customer's acceptance and approval. Approved budgets convert to numbered
  service orders once, copying items and payment conditions.
- Service orders with diagnosis, notes, status and item editing.
- Direct Pix QR restored in D1 PDFs when the saved payment method is Pix, using
  the original CR recipient and final document total. No bank request is made;
  the office checks receipt manually. This does not restore deleted Pix discount
  settings or change any saved discount percentage.
- Logo PDF download for budgets and orders. Native file sharing when supported;
  otherwise WhatsApp opens with instructions to attach the downloaded PDF.
- Server-side membership/role checks, office-scoped foreign keys, validated money,
  calculated totals and invalidation of acceptance when items/terms change.

No automatic PDF delivery, card checkout, customer portal, stock integration or
push/reminder delivery is enabled in these D1 modules. Other legacy routes remain
blocked in D1 mode. Existing Supabase code remains available in legacy mode.

## Configuration and migrations

Worker `cr-connect`; D1 binding `DB`, database `cr-connect`.
`CR_BACKEND=d1`, `AUTH_METHOD=password`, `APP_ORIGIN` is the published HTTPS origin.
`PASSWORD_PEPPER` is a private, inherited Worker secret; do not replace it during
updates or publish it in the frontend. No paid resources were purchased.

Migrations `0001_identity` through `0004_commerce` are applied remotely. Check
`cr_schema_migrations` before applying any migration; do not replay table creation.

## Verification

```sh
npm ci
npm run typecheck
npm run test:d1
node --test tests/pix-pdf.test.mjs
npm run build:vinext
# Set the local APP_ORIGIN and a local PASSWORD_PEPPER in ignored .dev.vars first.
CR_BROWSER_TEST=/tmp/cr-connect-clean-preview npm run test:d1-preview
```

The 23 API tests cover auth/session security, office/role isolation, money and
payment acceptance, duplicate conversion and labor adjustments. The compiled
Worker HTTP preview covers protected pages, customer/vehicle CRUD, the complete
budget-to-order API flow, registration, login and recovery. The published Worker also passed an isolated temporary-office test of protected
pages, client/vehicle creation, budgets, payment acceptance, repeat-safe conversion
and labor catalog creation; all temporary records were removed. PDF samples were
rendered and inspected with the existing CR logo. Playwright click-through checks
are prepared but browser startup is blocked by the environment's Unix-socket
restrictions; visual/click-through verification has not passed here.

Lists are capped at 1,000 rows. Add pagination before exceeding that size.
