-- Histórico e lembrete preventivo de correia dentada por veículo.
alter table public.vehicles
  add column if not exists timing_belt_changed_at date,
  add column if not exists timing_belt_changed_mileage integer,
  add column if not exists timing_belt_reminder_at date,
  add column if not exists timing_belt_reminder_mileage integer;

alter table public.vehicles
  drop constraint if exists vehicles_timing_belt_changed_mileage_check,
  drop constraint if exists vehicles_timing_belt_reminder_mileage_check;

alter table public.vehicles
  add constraint vehicles_timing_belt_changed_mileage_check check (timing_belt_changed_mileage is null or timing_belt_changed_mileage >= 0),
  add constraint vehicles_timing_belt_reminder_mileage_check check (timing_belt_reminder_mileage is null or timing_belt_reminder_mileage >= 0);
