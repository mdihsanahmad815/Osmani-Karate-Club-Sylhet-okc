# Osmani Karate Club Sylhet — Portal Update

## Important: one-time database migration
1. Open Supabase Dashboard → SQL Editor.
2. Create a new query and paste the full contents of `supabase/final-portal-migration.sql`.
3. Run it once. Confirm the final SELECT shows `mdihsanahmad815@gmail.com` with role `main_admin` and status `active`.
4. Do not put a service-role/secret key in `assets/supabase-config.js`.

## Deploy
Upload the contents of this ZIP to the existing GitHub repository, preserving the folder structure. In particular, keep `assets/portal.css`, `assets/portal.js`, `assets/admin.js`, and the new `assets/sensei.js` / `assets/offers.js` inside `assets/`.
Wait for Vercel deployment, then hard refresh the site.

## Account flow
- New signups are created as student accounts (never staff roles from signup metadata).
- Main Admin grants Admin/Sensei access from Admin Dashboard → Admin Accounts.
- Admin/Main Admin can read student records and manage payments, gallery, website banner, exam results and offers.
- Active Sensei accounts can upload their own photos/videos in Sensei Media Studio; Sensei can delete only their own uploads.
- Students can see only their own profile, payments and exam results.
- Public visitors can see published gallery items and published offers.

## Storage and size
Gallery files are limited to 50 MB. Student profile images and payment proofs retain their private bucket rules from the existing schema.

## Existing project note
This update preserves the existing public website pages and assets. Database policies and features cannot be verified against your live Supabase project from this ZIP alone. Run the migration and test with one test student and one test Sensei account before using real student records or payments.
