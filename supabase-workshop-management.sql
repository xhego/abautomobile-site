create extension if not exists pgcrypto;

-- AB's Auto Mobile Mechanic (Pty) Ltd
-- Supabase workshop management foundation.
--
-- Run this after supabase-setup.sql. It creates the private operational
-- workshop tables, RLS helpers, storage buckets, and key transactional
-- functions needed before wiring the Angular workshop pages to Supabase.

create table if not exists public.workshop_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'viewer' check (role in ('admin', 'workshop_manager', 'mechanic', 'viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.workshop_role_permissions (
  role text not null check (role in ('admin', 'workshop_manager', 'mechanic', 'viewer')),
  permission text not null,
  created_at timestamptz not null default now(),
  primary key (role, permission)
);

insert into public.workshop_role_permissions (role, permission)
values
  ('admin', 'workshop.view'),
  ('admin', 'workshop.manage_customers'),
  ('admin', 'workshop.manage_vehicles'),
  ('admin', 'workshop.view_full_vin'),
  ('admin', 'workshop.manage_bookings'),
  ('admin', 'workshop.manage_job_cards'),
  ('admin', 'workshop.change_job_status'),
  ('admin', 'workshop.manage_estimates'),
  ('admin', 'workshop.record_approvals'),
  ('admin', 'workshop.manage_parts'),
  ('admin', 'workshop.manage_invoices'),
  ('admin', 'workshop.record_payments'),
  ('admin', 'workshop.verify_payments'),
  ('admin', 'workshop.perform_quality_control'),
  ('admin', 'workshop.view_reports'),
  ('admin', 'workshop.export_data'),
  ('admin', 'workshop.admin_override'),
  ('workshop_manager', 'workshop.view'),
  ('workshop_manager', 'workshop.manage_customers'),
  ('workshop_manager', 'workshop.manage_vehicles'),
  ('workshop_manager', 'workshop.view_full_vin'),
  ('workshop_manager', 'workshop.manage_bookings'),
  ('workshop_manager', 'workshop.manage_job_cards'),
  ('workshop_manager', 'workshop.change_job_status'),
  ('workshop_manager', 'workshop.manage_estimates'),
  ('workshop_manager', 'workshop.record_approvals'),
  ('workshop_manager', 'workshop.manage_parts'),
  ('workshop_manager', 'workshop.manage_invoices'),
  ('workshop_manager', 'workshop.record_payments'),
  ('workshop_manager', 'workshop.perform_quality_control'),
  ('workshop_manager', 'workshop.view_reports'),
  ('mechanic', 'workshop.view'),
  ('mechanic', 'workshop.manage_job_cards'),
  ('mechanic', 'workshop.change_job_status'),
  ('mechanic', 'workshop.perform_quality_control'),
  ('viewer', 'workshop.view')
on conflict do nothing;

create or replace function public.is_workshop_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'abautomobile@gmail.com'
    or exists (
      select 1
      from public.workshop_profiles profile
      where profile.user_id = auth.uid()
        and profile.role = 'admin'
        and profile.is_active = true
    );
$$;

create or replace function public.has_workshop_permission(permission_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_workshop_admin()
    or exists (
      select 1
      from public.workshop_profiles profile
      join public.workshop_role_permissions permission
        on permission.role = profile.role
      where profile.user_id = auth.uid()
        and profile.is_active = true
        and permission.permission = permission_name
    );
$$;

insert into public.workshop_profiles (user_id, display_name, role)
select id, coalesce(raw_user_meta_data ->> 'name', email, 'AB Auto admin'), 'admin'
from auth.users
where email = 'abautomobile@gmail.com'
on conflict (user_id) do update
set role = 'admin',
    is_active = true,
    updated_at = now();

create table if not exists public.workshop_number_sequences (
  sequence_key text primary key,
  last_number integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.workshop_customers (
  id uuid primary key default gen_random_uuid(),
  customer_number text not null unique,
  customer_type text not null check (customer_type in ('individual', 'company', 'fleet')),
  first_name text,
  last_name text,
  company_name text,
  contact_person text,
  mobile_number text not null,
  alternate_number text,
  whatsapp_number text,
  email_address text,
  address_line_1 text,
  address_line_2 text,
  suburb text,
  city text,
  province text,
  postal_code text,
  preferred_contact_method text,
  notes text,
  popia_consent_at timestamptz,
  marketing_consent boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz,
  updated_by uuid references auth.users(id)
);

create table if not exists public.workshop_vehicles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.workshop_customers(id) on delete restrict,
  registration_number text,
  vin text,
  engine_number text,
  engine_code text,
  make text not null,
  model text not null,
  variant text,
  model_year smallint,
  colour text,
  fuel_type text,
  transmission_type text,
  current_mileage integer,
  fleet_number text,
  next_service_date date,
  next_service_mileage integer,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz,
  updated_by uuid references auth.users(id),
  constraint workshop_vehicles_vin_format check (
    vin is null or (
      length(vin) <= 17
      and vin = upper(vin)
      and vin !~ '[IOQ]'
      and vin ~ '^[A-HJ-NPR-Z0-9]+$'
    )
  )
);

create unique index if not exists ux_workshop_vehicles_vin
on public.workshop_vehicles (vin)
where vin is not null;

create index if not exists ix_workshop_vehicles_customer on public.workshop_vehicles(customer_id);
create index if not exists ix_workshop_vehicles_registration on public.workshop_vehicles(registration_number);

create table if not exists public.workshop_mechanics (
  id uuid primary key default gen_random_uuid(),
  profile_user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  mobile_number text,
  email_address text,
  skill_notes text,
  hourly_rate numeric(12, 2) not null default 0,
  is_available boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz,
  updated_by uuid references auth.users(id)
);

create table if not exists public.workshop_bays (
  id uuid primary key default gen_random_uuid(),
  bay_name text not null,
  bay_code text not null unique,
  description text,
  is_available boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz,
  updated_by uuid references auth.users(id)
);

create table if not exists public.workshop_bookings (
  id uuid primary key default gen_random_uuid(),
  booking_number text not null unique,
  customer_id uuid not null references public.workshop_customers(id) on delete restrict,
  vehicle_id uuid references public.workshop_vehicles(id) on delete restrict,
  booking_type text not null check (booking_type in ('workshop', 'mobile_callout')),
  scheduled_start_at timestamptz not null,
  scheduled_end_at timestamptz,
  status text not null default 'enquiry' check (status in ('enquiry', 'confirmed', 'cancelled', 'checked_in', 'converted_to_job')),
  job_type text,
  location_address text,
  callout_fee numeric(12, 2) not null default 0,
  callout_fee_approved boolean not null default false,
  assigned_mechanic_id uuid references public.workshop_mechanics(id) on delete set null,
  bay_id uuid references public.workshop_bays(id) on delete set null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz,
  updated_by uuid references auth.users(id),
  constraint workshop_bookings_valid_range check (scheduled_end_at is null or scheduled_end_at > scheduled_start_at)
);

create index if not exists ix_workshop_bookings_schedule on public.workshop_bookings(scheduled_start_at, scheduled_end_at);
create index if not exists ix_workshop_bookings_mechanic on public.workshop_bookings(assigned_mechanic_id);
create index if not exists ix_workshop_bookings_bay on public.workshop_bookings(bay_id);

create table if not exists public.workshop_job_cards (
  id uuid primary key default gen_random_uuid(),
  job_card_number text not null unique,
  booking_id uuid references public.workshop_bookings(id) on delete restrict,
  customer_id uuid not null references public.workshop_customers(id) on delete restrict,
  vehicle_id uuid not null references public.workshop_vehicles(id) on delete restrict,
  assigned_mechanic_id uuid references public.workshop_mechanics(id) on delete set null,
  bay_id uuid references public.workshop_bays(id) on delete set null,
  status text not null default 'booked',
  priority text not null default 'normal' check (priority in ('normal', 'urgent', 'waiting_customer', 'warranty_check')),
  odometer_reading integer,
  customer_complaint text,
  diagnosis_notes text,
  work_authorised_at timestamptz,
  expected_completion_at timestamptz,
  completed_at timestamptz,
  ready_for_collection_at timestamptz,
  collected_at timestamptz,
  total_estimate numeric(12, 2) not null default 0,
  total_invoiced numeric(12, 2) not null default 0,
  total_paid numeric(12, 2) not null default 0,
  outstanding_balance numeric(12, 2) generated always as (total_invoiced - total_paid) stored,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz,
  updated_by uuid references auth.users(id),
  constraint workshop_job_cards_status check (status in (
    'booked',
    'checked_in',
    'initial_inspection',
    'diagnosis',
    'awaiting_approval',
    'approved',
    'waiting_for_parts',
    'in_progress',
    'quality_control',
    'ready_for_collection',
    'completed',
    'collected',
    'on_hold',
    'paused',
    'cancelled',
    'warranty_assessment'
  ))
);

create index if not exists ix_workshop_job_cards_status on public.workshop_job_cards(status);
create index if not exists ix_workshop_job_cards_customer on public.workshop_job_cards(customer_id);
create index if not exists ix_workshop_job_cards_vehicle on public.workshop_job_cards(vehicle_id);
create index if not exists ix_workshop_job_cards_mechanic on public.workshop_job_cards(assigned_mechanic_id);

create table if not exists public.workshop_job_status_history (
  id uuid primary key default gen_random_uuid(),
  job_card_id uuid not null references public.workshop_job_cards(id) on delete restrict,
  previous_status text,
  next_status text not null,
  note text,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);

create table if not exists public.workshop_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  job_card_id uuid not null references public.workshop_job_cards(id) on delete restrict,
  customer_id uuid not null references public.workshop_customers(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'issued', 'cancelled', 'paid')),
  subtotal numeric(12, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  issued_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz,
  updated_by uuid references auth.users(id)
);

create table if not exists public.workshop_payments (
  id uuid primary key default gen_random_uuid(),
  payment_number text not null unique,
  customer_id uuid not null references public.workshop_customers(id) on delete restrict,
  job_card_id uuid references public.workshop_job_cards(id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  payment_method text not null default 'cash',
  reference text,
  verified_at timestamptz,
  verified_by uuid references auth.users(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz,
  updated_by uuid references auth.users(id)
);

create table if not exists public.workshop_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.workshop_payments(id) on delete restrict,
  invoice_id uuid references public.workshop_invoices(id) on delete restrict,
  job_card_id uuid references public.workshop_job_cards(id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.workshop_quality_checks (
  id uuid primary key default gen_random_uuid(),
  job_card_id uuid not null references public.workshop_job_cards(id) on delete restrict,
  test_drive_required boolean not null default false,
  test_drive_completed boolean not null default false,
  test_drive_mileage_before integer,
  test_drive_mileage_after integer,
  warning_lights_checked boolean not null default false,
  brakes_checked boolean not null default false,
  leaks_checked boolean not null default false,
  customer_concerns_reviewed boolean not null default false,
  completed_by uuid references auth.users(id),
  completed_at timestamptz,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz,
  updated_by uuid references auth.users(id)
);

create table if not exists public.workshop_vehicle_photos (
  id uuid primary key default gen_random_uuid(),
  job_card_id uuid references public.workshop_job_cards(id) on delete restrict,
  vehicle_id uuid references public.workshop_vehicles(id) on delete restrict,
  storage_path text not null,
  photo_type text,
  caption text,
  taken_at timestamptz not null default now(),
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.workshop_documents (
  id uuid primary key default gen_random_uuid(),
  job_card_id uuid references public.workshop_job_cards(id) on delete restrict,
  customer_id uuid references public.workshop_customers(id) on delete restrict,
  payment_id uuid references public.workshop_payments(id) on delete restrict,
  document_type text not null,
  storage_path text not null,
  file_name text,
  mime_type text,
  file_size integer,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.workshop_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create or replace function public.set_workshop_updated_fields()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create or replace function public.set_workshop_created_fields()
returns trigger
language plpgsql
as $$
begin
  new.created_by := coalesce(new.created_by, auth.uid());
  return new;
end;
$$;

create or replace function public.uppercase_vehicle_vin()
returns trigger
language plpgsql
as $$
begin
  if new.vin is not null then
    new.vin := upper(trim(new.vin));
  end if;
  return new;
end;
$$;

create or replace function public.workshop_next_number(p_sequence_key text, p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
begin
  insert into public.workshop_number_sequences(sequence_key, last_number)
  values (p_sequence_key, 0)
  on conflict (sequence_key) do nothing;

  update public.workshop_number_sequences
  set last_number = last_number + 1,
      updated_at = now()
  where workshop_number_sequences.sequence_key = p_sequence_key
  returning last_number into next_number;

  return p_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(next_number::text, 5, '0');
end;
$$;

create or replace function public.set_workshop_business_number()
returns trigger
language plpgsql
as $$
begin
  if TG_TABLE_NAME = 'workshop_customers' and coalesce(new.customer_number, '') = '' then
    new.customer_number := public.workshop_next_number('customer', 'CUS');
  elsif TG_TABLE_NAME = 'workshop_bookings' and coalesce(new.booking_number, '') = '' then
    new.booking_number := public.workshop_next_number('booking', 'BKG');
  elsif TG_TABLE_NAME = 'workshop_job_cards' and coalesce(new.job_card_number, '') = '' then
    new.job_card_number := public.workshop_next_number('job_card', 'JC');
  elsif TG_TABLE_NAME = 'workshop_invoices' and coalesce(new.invoice_number, '') = '' then
    new.invoice_number := public.workshop_next_number('invoice', 'INV');
  elsif TG_TABLE_NAME = 'workshop_payments' and coalesce(new.payment_number, '') = '' then
    new.payment_number := public.workshop_next_number('payment', 'PAY');
  end if;

  return new;
end;
$$;

create or replace function public.workshop_assert_schedule_available()
returns trigger
language plpgsql
as $$
declare
  booking_end timestamptz;
begin
  if new.status = 'cancelled' then
    return new;
  end if;

  booking_end := coalesce(new.scheduled_end_at, new.scheduled_start_at + interval '1 hour');

  if new.booking_type = 'mobile_callout' and new.status = 'confirmed' and new.callout_fee_approved = false then
    raise exception 'Mobile call-out fee must be agreed before confirming the booking.';
  end if;

  if new.assigned_mechanic_id is not null and exists (
    select 1
    from public.workshop_bookings existing
    where existing.id <> new.id
      and existing.assigned_mechanic_id = new.assigned_mechanic_id
      and existing.status not in ('cancelled', 'converted_to_job')
      and tstzrange(existing.scheduled_start_at, coalesce(existing.scheduled_end_at, existing.scheduled_start_at + interval '1 hour'), '[)')
        && tstzrange(new.scheduled_start_at, booking_end, '[)')
  ) then
    raise exception 'Assigned mechanic already has a booking in this time window.';
  end if;

  if new.bay_id is not null and exists (
    select 1
    from public.workshop_bookings existing
    where existing.id <> new.id
      and existing.bay_id = new.bay_id
      and existing.status not in ('cancelled', 'converted_to_job')
      and tstzrange(existing.scheduled_start_at, coalesce(existing.scheduled_end_at, existing.scheduled_start_at + interval '1 hour'), '[)')
        && tstzrange(new.scheduled_start_at, booking_end, '[)')
  ) then
    raise exception 'Workshop bay already has a booking in this time window.';
  end if;

  return new;
end;
$$;

create or replace function public.workshop_log_audit(action_name text, entity_type_name text, entity_id_value uuid, old_row jsonb default null, new_row jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workshop_audit_logs(user_id, action, entity_type, entity_id, old_values, new_values)
  values (auth.uid(), action_name, entity_type_name, entity_id_value, old_row, new_row);
end;
$$;

create or replace function public.workshop_allowed_status_transition(previous_status text, next_status text)
returns boolean
language sql
immutable
as $$
  select previous_status is null
    or next_status in ('on_hold', 'paused', 'cancelled', 'warranty_assessment')
    or (previous_status, next_status) in (
      ('booked', 'checked_in'),
      ('checked_in', 'initial_inspection'),
      ('initial_inspection', 'diagnosis'),
      ('diagnosis', 'awaiting_approval'),
      ('awaiting_approval', 'approved'),
      ('approved', 'waiting_for_parts'),
      ('approved', 'in_progress'),
      ('waiting_for_parts', 'in_progress'),
      ('in_progress', 'quality_control'),
      ('quality_control', 'ready_for_collection'),
      ('ready_for_collection', 'completed'),
      ('completed', 'collected'),
      ('paused', 'in_progress'),
      ('on_hold', 'diagnosis'),
      ('on_hold', 'awaiting_approval')
    );
$$;

create or replace function public.workshop_change_job_status(p_job_card_id uuid, p_next_status text, p_note text default null, p_admin_override boolean default false)
returns public.workshop_job_cards
language plpgsql
security definer
set search_path = public
as $$
declare
  current_job public.workshop_job_cards;
  updated_job public.workshop_job_cards;
begin
  if not public.has_workshop_permission('workshop.change_job_status') then
    raise exception 'Not allowed to change workshop job status.';
  end if;

  select * into current_job
  from public.workshop_job_cards
  where id = p_job_card_id
  for update;

  if not found then
    raise exception 'Workshop job card not found.';
  end if;

  if not public.workshop_allowed_status_transition(current_job.status, p_next_status) then
    raise exception 'Invalid job status transition from % to %.', current_job.status, p_next_status;
  end if;

  if p_next_status = 'collected' and current_job.outstanding_balance > 0 and not (p_admin_override and public.has_workshop_permission('workshop.admin_override')) then
    raise exception 'Cannot collect vehicle while balance is outstanding.';
  end if;

  update public.workshop_job_cards
  set status = p_next_status,
      ready_for_collection_at = case when p_next_status = 'ready_for_collection' then now() else ready_for_collection_at end,
      completed_at = case when p_next_status = 'completed' then now() else completed_at end,
      collected_at = case when p_next_status = 'collected' then now() else collected_at end,
      updated_at = now(),
      updated_by = auth.uid()
  where id = p_job_card_id
  returning * into updated_job;

  insert into public.workshop_job_status_history(job_card_id, previous_status, next_status, note, changed_by)
  values (p_job_card_id, current_job.status, p_next_status, p_note, auth.uid());

  perform public.workshop_log_audit('job_status_changed', 'workshop_job_cards', p_job_card_id, to_jsonb(current_job), to_jsonb(updated_job));

  return updated_job;
end;
$$;

create or replace function public.workshop_confirm_booking(p_booking_id uuid)
returns public.workshop_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  booking public.workshop_bookings;
begin
  if not public.has_workshop_permission('workshop.manage_bookings') then
    raise exception 'Not allowed to confirm bookings.';
  end if;

  select * into booking
  from public.workshop_bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking not found.';
  end if;

  if booking.status = 'cancelled' then
    raise exception 'Cancelled bookings cannot be confirmed.';
  end if;

  if booking.booking_type = 'mobile_callout' and booking.callout_fee_approved = false then
    raise exception 'Mobile call-out fee must be agreed before dispatch.';
  end if;

  update public.workshop_bookings
  set status = 'confirmed',
      updated_at = now(),
      updated_by = auth.uid()
  where id = p_booking_id
  returning * into booking;

  perform public.workshop_log_audit('booking_confirmed', 'workshop_bookings', p_booking_id, null, to_jsonb(booking));
  return booking;
end;
$$;

create or replace function public.workshop_create_job_card_from_booking(p_booking_id uuid)
returns public.workshop_job_cards
language plpgsql
security definer
set search_path = public
as $$
declare
  booking public.workshop_bookings;
  job public.workshop_job_cards;
begin
  if not public.has_workshop_permission('workshop.manage_job_cards') then
    raise exception 'Not allowed to create job cards.';
  end if;

  select * into booking
  from public.workshop_bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking not found.';
  end if;

  if booking.status not in ('confirmed', 'checked_in') then
    raise exception 'Only confirmed or checked-in bookings can become job cards.';
  end if;

  if booking.vehicle_id is null then
    raise exception 'A vehicle is required before creating a job card.';
  end if;

  insert into public.workshop_job_cards (
    job_card_number,
    booking_id,
    customer_id,
    vehicle_id,
    assigned_mechanic_id,
    bay_id,
    status,
    customer_complaint,
    created_by
  )
  values (
    public.workshop_next_number('job_card', 'JC'),
    booking.id,
    booking.customer_id,
    booking.vehicle_id,
    booking.assigned_mechanic_id,
    booking.bay_id,
    'checked_in',
    booking.job_type,
    auth.uid()
  )
  returning * into job;

  update public.workshop_bookings
  set status = 'converted_to_job',
      updated_at = now(),
      updated_by = auth.uid()
  where id = booking.id;

  insert into public.workshop_job_status_history(job_card_id, previous_status, next_status, note, changed_by)
  values (job.id, null, 'checked_in', 'Created from booking ' || booking.booking_number, auth.uid());

  perform public.workshop_log_audit('job_card_created_from_booking', 'workshop_job_cards', job.id, null, to_jsonb(job));
  return job;
end;
$$;

create or replace function public.workshop_record_payment(p_customer_id uuid, p_job_card_id uuid, p_amount numeric, p_payment_method text, p_reference text default null)
returns public.workshop_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  payment public.workshop_payments;
begin
  if not public.has_workshop_permission('workshop.record_payments') then
    raise exception 'Not allowed to record payments.';
  end if;

  if p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;

  insert into public.workshop_payments (
    payment_number,
    customer_id,
    job_card_id,
    amount,
    payment_method,
    reference,
    created_by
  )
  values (
    public.workshop_next_number('payment', 'PAY'),
    p_customer_id,
    p_job_card_id,
    p_amount,
    p_payment_method,
    p_reference,
    auth.uid()
  )
  returning * into payment;

  insert into public.workshop_payment_allocations(payment_id, job_card_id, amount, created_by)
  values (payment.id, p_job_card_id, p_amount, auth.uid());

  update public.workshop_job_cards
  set total_paid = total_paid + p_amount,
      updated_at = now(),
      updated_by = auth.uid()
  where id = p_job_card_id;

  perform public.workshop_log_audit('payment_recorded', 'workshop_payments', payment.id, null, to_jsonb(payment));
  return payment;
end;
$$;

create or replace function public.apply_workshop_triggers(table_name text)
returns void
language plpgsql
as $$
begin
  execute format('drop trigger if exists %I on public.%I', table_name || '_created_by', table_name);
  execute format('create trigger %I before insert on public.%I for each row execute function public.set_workshop_created_fields()', table_name || '_created_by', table_name);
  execute format('drop trigger if exists %I on public.%I', table_name || '_updated_at', table_name);
  execute format('create trigger %I before update on public.%I for each row execute function public.set_workshop_updated_fields()', table_name || '_updated_at', table_name);
end;
$$;

select public.apply_workshop_triggers(table_name)
from (
  values
    ('workshop_customers'),
    ('workshop_vehicles'),
    ('workshop_mechanics'),
    ('workshop_bays'),
    ('workshop_bookings'),
    ('workshop_job_cards'),
    ('workshop_invoices'),
    ('workshop_payments'),
    ('workshop_quality_checks')
) as tables(table_name);

drop trigger if exists workshop_vehicles_uppercase_vin on public.workshop_vehicles;
create trigger workshop_vehicles_uppercase_vin
before insert or update on public.workshop_vehicles
for each row
execute function public.uppercase_vehicle_vin();

drop trigger if exists workshop_customers_business_number on public.workshop_customers;
create trigger workshop_customers_business_number
before insert on public.workshop_customers
for each row
execute function public.set_workshop_business_number();

drop trigger if exists workshop_bookings_business_number on public.workshop_bookings;
create trigger workshop_bookings_business_number
before insert on public.workshop_bookings
for each row
execute function public.set_workshop_business_number();

drop trigger if exists workshop_job_cards_business_number on public.workshop_job_cards;
create trigger workshop_job_cards_business_number
before insert on public.workshop_job_cards
for each row
execute function public.set_workshop_business_number();

drop trigger if exists workshop_invoices_business_number on public.workshop_invoices;
create trigger workshop_invoices_business_number
before insert on public.workshop_invoices
for each row
execute function public.set_workshop_business_number();

drop trigger if exists workshop_payments_business_number on public.workshop_payments;
create trigger workshop_payments_business_number
before insert on public.workshop_payments
for each row
execute function public.set_workshop_business_number();

drop trigger if exists workshop_bookings_schedule_guard on public.workshop_bookings;
create trigger workshop_bookings_schedule_guard
before insert or update on public.workshop_bookings
for each row
execute function public.workshop_assert_schedule_available();

drop function if exists public.apply_workshop_triggers(text);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('workshop-vehicle-photos', 'workshop-vehicle-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('workshop-payment-documents', 'workshop-payment-documents', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('workshop-quality-documents', 'workshop-quality-documents', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.workshop_profiles enable row level security;
alter table public.workshop_role_permissions enable row level security;
alter table public.workshop_number_sequences enable row level security;
alter table public.workshop_customers enable row level security;
alter table public.workshop_vehicles enable row level security;
alter table public.workshop_mechanics enable row level security;
alter table public.workshop_bays enable row level security;
alter table public.workshop_bookings enable row level security;
alter table public.workshop_job_cards enable row level security;
alter table public.workshop_job_status_history enable row level security;
alter table public.workshop_invoices enable row level security;
alter table public.workshop_payments enable row level security;
alter table public.workshop_payment_allocations enable row level security;
alter table public.workshop_quality_checks enable row level security;
alter table public.workshop_vehicle_photos enable row level security;
alter table public.workshop_documents enable row level security;
alter table public.workshop_audit_logs enable row level security;

drop policy if exists "Workshop users can read own profile" on public.workshop_profiles;
create policy "Workshop users can read own profile"
on public.workshop_profiles
for select
to authenticated
using (user_id = auth.uid() or public.is_workshop_admin());

drop policy if exists "Admins can manage workshop profiles" on public.workshop_profiles;
create policy "Admins can manage workshop profiles"
on public.workshop_profiles
for all
to authenticated
using (public.is_workshop_admin())
with check (public.is_workshop_admin());

drop policy if exists "Workshop users can read permissions" on public.workshop_role_permissions;
create policy "Workshop users can read permissions"
on public.workshop_role_permissions
for select
to authenticated
using (public.has_workshop_permission('workshop.view'));

drop policy if exists "Workshop admins can manage permissions" on public.workshop_role_permissions;
create policy "Workshop admins can manage permissions"
on public.workshop_role_permissions
for all
to authenticated
using (public.is_workshop_admin())
with check (public.is_workshop_admin());

drop policy if exists "Workshop users can read sequences" on public.workshop_number_sequences;
create policy "Workshop users can read sequences"
on public.workshop_number_sequences
for select
to authenticated
using (public.is_workshop_admin());

drop policy if exists "Workshop users can view customers" on public.workshop_customers;
create policy "Workshop users can view customers"
on public.workshop_customers
for select
to authenticated
using (public.has_workshop_permission('workshop.view'));

drop policy if exists "Workshop users can manage customers" on public.workshop_customers;
create policy "Workshop users can manage customers"
on public.workshop_customers
for all
to authenticated
using (public.has_workshop_permission('workshop.manage_customers'))
with check (public.has_workshop_permission('workshop.manage_customers'));

drop policy if exists "Workshop users can view vehicles" on public.workshop_vehicles;
create policy "Workshop users can view vehicles"
on public.workshop_vehicles
for select
to authenticated
using (public.has_workshop_permission('workshop.view'));

drop policy if exists "Workshop users can manage vehicles" on public.workshop_vehicles;
create policy "Workshop users can manage vehicles"
on public.workshop_vehicles
for all
to authenticated
using (public.has_workshop_permission('workshop.manage_vehicles'))
with check (public.has_workshop_permission('workshop.manage_vehicles'));

drop policy if exists "Workshop users can view mechanics" on public.workshop_mechanics;
create policy "Workshop users can view mechanics"
on public.workshop_mechanics
for select
to authenticated
using (public.has_workshop_permission('workshop.view'));

drop policy if exists "Workshop managers can manage mechanics" on public.workshop_mechanics;
create policy "Workshop managers can manage mechanics"
on public.workshop_mechanics
for all
to authenticated
using (public.is_workshop_admin())
with check (public.is_workshop_admin());

drop policy if exists "Workshop users can view bays" on public.workshop_bays;
create policy "Workshop users can view bays"
on public.workshop_bays
for select
to authenticated
using (public.has_workshop_permission('workshop.view'));

drop policy if exists "Workshop managers can manage bays" on public.workshop_bays;
create policy "Workshop managers can manage bays"
on public.workshop_bays
for all
to authenticated
using (public.is_workshop_admin())
with check (public.is_workshop_admin());

drop policy if exists "Workshop users can view bookings" on public.workshop_bookings;
create policy "Workshop users can view bookings"
on public.workshop_bookings
for select
to authenticated
using (public.has_workshop_permission('workshop.view'));

drop policy if exists "Workshop users can manage bookings" on public.workshop_bookings;
create policy "Workshop users can manage bookings"
on public.workshop_bookings
for all
to authenticated
using (public.has_workshop_permission('workshop.manage_bookings'))
with check (public.has_workshop_permission('workshop.manage_bookings'));

drop policy if exists "Workshop users can view job cards" on public.workshop_job_cards;
create policy "Workshop users can view job cards"
on public.workshop_job_cards
for select
to authenticated
using (public.has_workshop_permission('workshop.view'));

drop policy if exists "Workshop users can manage job cards" on public.workshop_job_cards;
create policy "Workshop users can manage job cards"
on public.workshop_job_cards
for all
to authenticated
using (public.has_workshop_permission('workshop.manage_job_cards'))
with check (public.has_workshop_permission('workshop.manage_job_cards'));

drop policy if exists "Workshop users can view operational child records" on public.workshop_job_status_history;
create policy "Workshop users can view operational child records"
on public.workshop_job_status_history
for select
to authenticated
using (public.has_workshop_permission('workshop.view'));

drop policy if exists "Workshop users can insert operational child records" on public.workshop_job_status_history;
create policy "Workshop users can insert operational child records"
on public.workshop_job_status_history
for insert
to authenticated
with check (public.has_workshop_permission('workshop.change_job_status'));

drop policy if exists "Workshop users can view invoices" on public.workshop_invoices;
create policy "Workshop users can view invoices"
on public.workshop_invoices
for select
to authenticated
using (public.has_workshop_permission('workshop.view'));

drop policy if exists "Workshop users can manage invoices" on public.workshop_invoices;
create policy "Workshop users can manage invoices"
on public.workshop_invoices
for all
to authenticated
using (public.has_workshop_permission('workshop.manage_invoices'))
with check (public.has_workshop_permission('workshop.manage_invoices'));

drop policy if exists "Workshop users can view payments" on public.workshop_payments;
create policy "Workshop users can view payments"
on public.workshop_payments
for select
to authenticated
using (public.has_workshop_permission('workshop.view'));

drop policy if exists "Workshop users can record payments" on public.workshop_payments;
create policy "Workshop users can record payments"
on public.workshop_payments
for insert
to authenticated
with check (public.has_workshop_permission('workshop.record_payments'));

drop policy if exists "Workshop users can view payment allocations" on public.workshop_payment_allocations;
create policy "Workshop users can view payment allocations"
on public.workshop_payment_allocations
for select
to authenticated
using (public.has_workshop_permission('workshop.view'));

drop policy if exists "Workshop users can record payment allocations" on public.workshop_payment_allocations;
create policy "Workshop users can record payment allocations"
on public.workshop_payment_allocations
for insert
to authenticated
with check (public.has_workshop_permission('workshop.record_payments'));

drop policy if exists "Workshop users can view quality checks" on public.workshop_quality_checks;
create policy "Workshop users can view quality checks"
on public.workshop_quality_checks
for select
to authenticated
using (public.has_workshop_permission('workshop.view'));

drop policy if exists "Workshop users can manage quality checks" on public.workshop_quality_checks;
create policy "Workshop users can manage quality checks"
on public.workshop_quality_checks
for all
to authenticated
using (public.has_workshop_permission('workshop.perform_quality_control'))
with check (public.has_workshop_permission('workshop.perform_quality_control'));

drop policy if exists "Workshop users can view vehicle photos" on public.workshop_vehicle_photos;
create policy "Workshop users can view vehicle photos"
on public.workshop_vehicle_photos
for select
to authenticated
using (public.has_workshop_permission('workshop.view'));

drop policy if exists "Workshop users can manage vehicle photos" on public.workshop_vehicle_photos;
create policy "Workshop users can manage vehicle photos"
on public.workshop_vehicle_photos
for all
to authenticated
using (public.has_workshop_permission('workshop.manage_job_cards'))
with check (public.has_workshop_permission('workshop.manage_job_cards'));

drop policy if exists "Workshop users can view documents" on public.workshop_documents;
create policy "Workshop users can view documents"
on public.workshop_documents
for select
to authenticated
using (public.has_workshop_permission('workshop.view'));

drop policy if exists "Workshop users can manage documents" on public.workshop_documents;
create policy "Workshop users can manage documents"
on public.workshop_documents
for all
to authenticated
using (public.has_workshop_permission('workshop.manage_job_cards'))
with check (public.has_workshop_permission('workshop.manage_job_cards'));

drop policy if exists "Workshop admins can view audit logs" on public.workshop_audit_logs;
create policy "Workshop admins can view audit logs"
on public.workshop_audit_logs
for select
to authenticated
using (public.has_workshop_permission('workshop.view_reports'));

drop policy if exists "Workshop users can insert audit logs" on public.workshop_audit_logs;
create policy "Workshop users can insert audit logs"
on public.workshop_audit_logs
for insert
to authenticated
with check (public.has_workshop_permission('workshop.view'));

drop policy if exists "Workshop users can read private workshop storage" on storage.objects;
create policy "Workshop users can read private workshop storage"
on storage.objects
for select
to authenticated
using (
  bucket_id in ('workshop-vehicle-photos', 'workshop-payment-documents', 'workshop-quality-documents')
  and public.has_workshop_permission('workshop.view')
);

drop policy if exists "Workshop users can upload private workshop storage" on storage.objects;
create policy "Workshop users can upload private workshop storage"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('workshop-vehicle-photos', 'workshop-payment-documents', 'workshop-quality-documents')
  and public.has_workshop_permission('workshop.manage_job_cards')
);

drop policy if exists "Workshop users can delete private workshop storage" on storage.objects;
create policy "Workshop users can delete private workshop storage"
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('workshop-vehicle-photos', 'workshop-payment-documents', 'workshop-quality-documents')
  and public.is_workshop_admin()
);
