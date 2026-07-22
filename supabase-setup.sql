create extension if not exists pgcrypto;

create table if not exists public.site_settings (
  id text primary key default 'main',
  location text not null default 'Meyerton, Gauteng, South Africa',
  call_number text not null default '067 825 2864',
  whatsapp_number text not null default '073 015 1945',
  email_address text not null default 'ab@abautomobile.co.za',
  updated_at timestamptz not null default now()
);

create table if not exists public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  src_img text not null,
  title varchar(50) not null default '',
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.prevent_gallery_overflow()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.gallery_images) >= 10 then
    raise exception 'Only 10 gallery images can be live at once.';
  end if;

  new.title := left(coalesce(new.title, ''), 50);
  return new;
end;
$$;

drop trigger if exists gallery_images_max_10 on public.gallery_images;
create trigger gallery_images_max_10
before insert on public.gallery_images
for each row
execute function public.prevent_gallery_overflow();

insert into public.site_settings (id, location, call_number, whatsapp_number, email_address)
values ('main', 'Meyerton, Gauteng, South Africa', '067 825 2864', '073 015 1945', 'ab@abautomobile.co.za')
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.site_settings enable row level security;
alter table public.gallery_images enable row level security;

drop policy if exists "Public can read site settings" on public.site_settings;
create policy "Public can read site settings"
on public.site_settings
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated admin can manage site settings" on public.site_settings;
create policy "Authenticated admin can manage site settings"
on public.site_settings
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read gallery images" on public.gallery_images;
create policy "Public can read gallery images"
on public.gallery_images
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated admin can manage gallery images" on public.gallery_images;
create policy "Authenticated admin can manage gallery images"
on public.gallery_images
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read gallery storage" on storage.objects;
create policy "Public can read gallery storage"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'gallery');

drop policy if exists "Authenticated admin can upload gallery storage" on storage.objects;
create policy "Authenticated admin can upload gallery storage"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'gallery');

drop policy if exists "Authenticated admin can update gallery storage" on storage.objects;
create policy "Authenticated admin can update gallery storage"
on storage.objects
for update
to authenticated
using (bucket_id = 'gallery')
with check (bucket_id = 'gallery');

drop policy if exists "Authenticated admin can delete gallery storage" on storage.objects;
create policy "Authenticated admin can delete gallery storage"
on storage.objects
for delete
to authenticated
using (bucket_id = 'gallery');
