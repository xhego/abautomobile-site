-- AB's Auto Mobile Mechanic (Pty) Ltd
-- Run this once in Supabase Dashboard > SQL Editor.
-- It repairs the private workshop evidence storage used by the live site.

create or replace function public.is_ab_auto_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'abautomobile@gmail.com';
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('workshop-vehicle-photos', 'workshop-vehicle-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('workshop-payment-documents', 'workshop-payment-documents', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "AB Auto admins can view workshop evidence" on storage.objects;
create policy "AB Auto admins can view workshop evidence"
on storage.objects for select to authenticated
using (
  bucket_id in ('workshop-vehicle-photos', 'workshop-payment-documents')
  and public.is_ab_auto_admin()
);

drop policy if exists "AB Auto admins can upload workshop evidence" on storage.objects;
create policy "AB Auto admins can upload workshop evidence"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('workshop-vehicle-photos', 'workshop-payment-documents')
  and public.is_ab_auto_admin()
);

drop policy if exists "AB Auto admins can delete workshop evidence" on storage.objects;
create policy "AB Auto admins can delete workshop evidence"
on storage.objects for delete to authenticated
using (
  bucket_id in ('workshop-vehicle-photos', 'workshop-payment-documents')
  and public.is_ab_auto_admin()
);
