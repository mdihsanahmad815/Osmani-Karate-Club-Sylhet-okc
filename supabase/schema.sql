-- Osmani Karate Club Sylhet: initial Supabase schema
-- Run in Supabase SQL Editor after creating a project.
-- IMPORTANT: bootstrap the first Main Admin manually as described in SETUP-GUIDE-BN.md.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text not null default '',
  requested_roll_no text,
  role text not null default 'student' check (role in ('student','sensei','trainer','admin','main_admin','developer')),
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  roll_no text not null unique,
  full_name text not null,
  phone text,
  guardian_name text,
  guardian_phone text,
  address text,
  batch text,
  belt_level text,
  monthly_fee numeric(10,2) not null default 0 check (monthly_fee >= 0),
  status text not null default 'active' check (status in ('active','inactive','left')),
  admission_date date default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  amount numeric(10,2) not null check (amount > 0),
  payment_month date not null,
  method text not null check (method in ('bkash','nagad','cash','other')),
  sender_phone text,
  transaction_id text,
  proof_path text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint payments_transaction_id_unique unique (transaction_id)
);

create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  caption text not null default '',
  media_type text not null check (media_type in ('image','video','facebook')),
  storage_path text,
  external_url text,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint gallery_media_location check (
    (media_type in ('image','video') and storage_path is not null)
    or (media_type = 'facebook' and external_url is not null)
  )
);

create table if not exists public.site_content (
  content_key text primary key,
  content_value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists students_roll_idx on public.students(roll_no);
create index if not exists payments_student_month_idx on public.payments(student_id, payment_month desc);
create index if not exists payments_status_idx on public.payments(status);
create index if not exists gallery_published_order_idx on public.gallery_items(is_published, sort_order, created_at desc);
create index if not exists activity_created_idx on public.activity_logs(created_at desc);

-- Create a safe profile row on every signup. User metadata can never assign a staff role.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone, requested_roll_no, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.email,''),
    coalesce(new.raw_user_meta_data->>'phone',''),
    nullif(new.raw_user_meta_data->>'roll_no',''),
    'student',
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','main_admin','developer') and status = 'active'
  );
$$;

create or replace function public.is_main_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('main_admin','developer') and status = 'active'
  );
$$;

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.payments enable row level security;
alter table public.gallery_items enable row level security;
alter table public.site_content enable row level security;
alter table public.activity_logs enable row level security;

-- Profiles: users can read their own; staff can read all. Only Main Admin can change roles.
drop policy if exists "profile read own or staff" on public.profiles;
create policy "profile read own or staff" on public.profiles for select
using (id = auth.uid() or public.is_staff());

-- Profile changes are staff-managed; users cannot change their own role or activation status.
drop policy if exists "main admin manage profiles" on public.profiles;
create policy "main admin manage profiles" on public.profiles for all
using (public.is_main_admin()) with check (public.is_main_admin());

-- Student records: linked student can see their own; staff manage all.
drop policy if exists "student read own or staff" on public.students;
create policy "student read own or staff" on public.students for select
using (user_id = auth.uid() or public.is_staff());

drop policy if exists "staff manage students" on public.students;
create policy "staff manage students" on public.students for all
using (public.is_staff()) with check (public.is_staff());

-- Students may submit payments only for their linked record. Staff can review/manage.
drop policy if exists "payment read own or staff" on public.payments;
create policy "payment read own or staff" on public.payments for select
using (user_id = auth.uid() or public.is_staff());

drop policy if exists "student submit own payment" on public.payments;
create policy "student submit own payment" on public.payments for insert
with check (
  user_id = auth.uid()
  and status = 'pending'
  and reviewed_by is null
  and exists (select 1 from public.students s where s.id = student_id and s.user_id = auth.uid())
);

drop policy if exists "staff update payments" on public.payments;
create policy "staff update payments" on public.payments for update
using (public.is_staff()) with check (public.is_staff());

-- Public gallery reads only published items. Staff manage gallery.
drop policy if exists "public read published gallery" on public.gallery_items;
create policy "public read published gallery" on public.gallery_items for select
using (is_published = true or public.is_staff());

drop policy if exists "staff manage gallery" on public.gallery_items;
create policy "staff manage gallery" on public.gallery_items for all
using (public.is_staff()) with check (public.is_staff());

-- Website content: public read; staff update.
drop policy if exists "public read site content" on public.site_content;
create policy "public read site content" on public.site_content for select using (true);

drop policy if exists "staff manage site content" on public.site_content;
create policy "staff manage site content" on public.site_content for all
using (public.is_staff()) with check (public.is_staff());

-- Activity history: staff can read; inserts allowed for authenticated users, actor must be self.
drop policy if exists "staff read activity" on public.activity_logs;
create policy "staff read activity" on public.activity_logs for select using (public.is_staff());

drop policy if exists "authenticated create own activity" on public.activity_logs;
create policy "authenticated create own activity" on public.activity_logs for insert
with check (actor_id = auth.uid());

-- Storage: private payment proofs, public gallery files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('payment-proofs','payment-proofs',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']),
  ('club-gallery','club-gallery',true,52428800,array['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
on conflict (id) do nothing;

drop policy if exists "students upload own payment proof" on storage.objects;
create policy "students upload own payment proof" on storage.objects for insert to authenticated
with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "students read own payment proof or staff" on storage.objects;
create policy "students read own payment proof or staff" on storage.objects for select to authenticated
using (bucket_id = 'payment-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

drop policy if exists "staff manage payment proofs" on storage.objects;
create policy "staff manage payment proofs" on storage.objects for delete to authenticated
using (bucket_id = 'payment-proofs' and public.is_staff());

drop policy if exists "public read club gallery" on storage.objects;
create policy "public read club gallery" on storage.objects for select
using (bucket_id = 'club-gallery');

drop policy if exists "staff upload club gallery" on storage.objects;
create policy "staff upload club gallery" on storage.objects for insert to authenticated
with check (bucket_id = 'club-gallery' and public.is_staff());

drop policy if exists "staff update club gallery" on storage.objects;
create policy "staff update club gallery" on storage.objects for update to authenticated
using (bucket_id = 'club-gallery' and public.is_staff())
with check (bucket_id = 'club-gallery' and public.is_staff());

drop policy if exists "staff delete club gallery" on storage.objects;
create policy "staff delete club gallery" on storage.objects for delete to authenticated
using (bucket_id = 'club-gallery' and public.is_staff());

-- Example editable content values; website display mappings can be expanded later.
insert into public.site_content (content_key, content_value) values
('home_banner', '{"title":"শিখবো কারাতে — শিখাবো কারাতে — কারাতে শিখবে বাংলাদেশ 🇧🇩","subtitle":"Osmani Karate Club Sylhet"}'::jsonb)
on conflict (content_key) do nothing;


-- FIRST DEVELOPER BOOTSTRAP (run after this email has signed up once)
-- This is the single privileged developer account for the website.
-- Never allow users to choose this role during public signup.
update public.profiles p
set role = 'developer', status = 'active', updated_at = now()
from auth.users u
where p.id = u.id and lower(u.email) = 'mdihsanahmadr10@gmail.com';

-- Developer/admin invitation policy note:
-- Only Developer (or Main Admin) can grant staff roles from the protected dashboard.
-- Configure an email provider/Edge Function to send invite + approval notices to
-- mdihsanahmadr10@gmail.com; do not put Gmail passwords or service-role keys in frontend code.
