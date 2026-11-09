-- OKC FINAL PORTAL EXTENSIONS (run once in Supabase SQL Editor after backup)
-- Safe to re-run. Keeps student data private; no service-role key is used in the browser.

-- Roles and access helpers
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
 check (role in ('student','sensei','trainer','admin','main_admin','developer'));

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid()
 and role in ('admin','main_admin','developer') and status='active');
$$;
create or replace function public.is_main_admin()
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid()
 and role in ('main_admin','developer') and status='active');
$$;
create or replace function public.is_gallery_editor()
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid()
 and role in ('sensei','admin','main_admin','developer') and status='active');
$$;

-- Signup is always a student. Staff roles are granted by Main Admin only.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,full_name,email,phone,requested_roll_no,role,status)
 values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),
 coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'phone',''),
 nullif(new.raw_user_meta_data->>'roll_no',''),'student','active')
 on conflict(id) do nothing;
 return new;
end; $$;

-- Bootstrap Main Admin by the exact account email.
update public.profiles set role='main_admin',status='active',updated_at=now()
where lower(email)=lower('mdihsanahmad815@gmail.com');

-- Exam results: staff can manage, a student can read only their own result.
create table if not exists public.exam_results(
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.students(id) on delete cascade,
 exam_name text not null,
 exam_date date,
 subject text not null default 'Karate Examination',
 score numeric(7,2),
 grade text,
 result text not null default '',
 remarks text not null default '',
 published boolean not null default true,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.exam_results enable row level security;
drop policy if exists "exam results read own or staff" on public.exam_results;
create policy "exam results read own or staff" on public.exam_results for select to authenticated
using (public.is_staff() or exists(select 1 from public.students s where s.id=student_id and s.user_id=auth.uid()));
drop policy if exists "staff manage exam results" on public.exam_results;
create policy "staff manage exam results" on public.exam_results for all to authenticated
using(public.is_staff()) with check(public.is_staff());

-- Offers: public can read currently published offers; staff can manage them.
create table if not exists public.club_offers(
 id uuid primary key default gen_random_uuid(),
 title text not null,
 description text not null default '',
 starts_on date,
 ends_on date,
 is_published boolean not null default true,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.club_offers enable row level security;
drop policy if exists "public read published offers" on public.club_offers;
create policy "public read published offers" on public.club_offers for select
using(is_published=true or public.is_staff());
drop policy if exists "staff manage offers" on public.club_offers;
create policy "staff manage offers" on public.club_offers for all to authenticated
using(public.is_staff()) with check(public.is_staff());

-- Gallery: Sensei can upload and remove only their own media; Admins can manage all.
drop policy if exists "staff manage gallery" on public.gallery_items;
drop policy if exists "sensei add gallery" on public.gallery_items;
create policy "staff manage gallery" on public.gallery_items for all to authenticated
using(public.is_staff()) with check(public.is_staff());
create policy "sensei add gallery" on public.gallery_items for insert to authenticated
with check(public.is_gallery_editor() and created_by=auth.uid());
drop policy if exists "sensei delete own gallery" on public.gallery_items;
create policy "sensei delete own gallery" on public.gallery_items for delete to authenticated
using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='sensei' and p.status='active')
 and created_by=auth.uid());

-- Storage policies for gallery uploads by active Sensei/Admin/Main Admin.
drop policy if exists "staff upload gallery" on storage.objects;
drop policy if exists "gallery editor upload" on storage.objects;
create policy "gallery editor upload" on storage.objects for insert to authenticated
with check(bucket_id='club-gallery' and public.is_gallery_editor()
 and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "staff delete gallery files" on storage.objects;
create policy "gallery editor delete own files" on storage.objects for delete to authenticated
using(bucket_id='club-gallery' and (public.is_staff() or
 ((storage.foldername(name))[1]=auth.uid()::text and exists(
 select 1 from public.profiles p where p.id=auth.uid() and p.role='sensei' and p.status='active'))));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('club-gallery','club-gallery',true,52428800,
 array['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
on conflict(id) do update set public=true,file_size_limit=52428800,
allowed_mime_types=array['image/jpeg','image/png','image/webp','video/mp4','video/webm'];

-- Verify Main Admin profile after running:
select id,full_name,email,role,status from public.profiles
where lower(email)=lower('mdihsanahmad815@gmail.com');
