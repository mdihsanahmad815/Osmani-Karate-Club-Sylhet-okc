-- Osmani Karate Club Sylhet: existing-project migration
-- Run once in Supabase SQL Editor as project owner. Back up first.
-- This migration does NOT expose student records publicly.

-- 1) Main Admin role and existing helper functions
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student','sensei','trainer','admin','main_admin','developer'));

create or replace function public.is_admin_or_developer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid()
    and role in ('admin','main_admin','developer') and status = 'active');
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin_or_developer();
$$;

create or replace function public.is_main_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid()
    and role = 'main_admin' and status = 'active');
$$;

-- 2) New student signups become active automatically (Auth email confirmation is a separate setting).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone, requested_roll_no, role, status)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), coalesce(new.email,''),
    coalesce(new.raw_user_meta_data->>'phone',''), nullif(new.raw_user_meta_data->>'roll_no',''), 'student', 'active')
  on conflict (id) do nothing;
  return new;
end; $$;

-- 3) Add private student profile-photo storage and student admission columns
alter table public.students add column if not exists photo_path text;
alter table public.students add column if not exists address text;
alter table public.students add column if not exists guardian_name text;
alter table public.students add column if not exists guardian_phone text;
alter table public.students add column if not exists batch text;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('student-photos','student-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=5242880, allowed_mime_types=array['image/jpeg','image/png','image/webp'];

-- Students may create their own admission record; they can read only their own row.
drop policy if exists "student submit own admission" on public.students;
create policy "student submit own admission" on public.students for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "student read own or staff" on public.students;
create policy "student read own or staff" on public.students for select to authenticated
using (user_id = auth.uid() or public.is_staff());

-- Private photo upload/read: owner and authorized staff only.
drop policy if exists "student upload own profile photo" on storage.objects;
create policy "student upload own profile photo" on storage.objects for insert to authenticated
with check (bucket_id='student-photos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "student read own photo or staff" on storage.objects;
create policy "student read own photo or staff" on storage.objects for select to authenticated
using (bucket_id='student-photos' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_staff()));

-- 4) Bootstrap the Main Admin account. This exact email must already exist in Auth.
update public.profiles set role='main_admin', status='active', updated_at=now()
where lower(email)=lower('mdihsanahmad815@gmail.com');

-- Verify: expect exactly one row and role=main_admin.
select id, full_name, email, role, status from public.profiles
where lower(email)=lower('mdihsanahmad815@gmail.com');
