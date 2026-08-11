alter table public.workshops
  add column if not exists legal_name text,
  add column if not exists document text,
  add column if not exists phone text,
  add column if not exists whatsapp text,
  add column if not exists email text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists postal_code text,
  add column if not exists logo_url text;
