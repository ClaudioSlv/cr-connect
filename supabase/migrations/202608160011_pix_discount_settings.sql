-- Percentual configurável de desconto para pagamentos Pix em orçamentos.
alter table public.workshops
  add column if not exists pix_discount_percentage numeric(5,2) not null default 7
  check (pix_discount_percentage >= 0 and pix_discount_percentage <= 100);
