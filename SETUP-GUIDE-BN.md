# Osmani Karate Club Sylhet — Upgrade Package

এই প্যাকেজে মূল ওয়েবসাইটের পেজ, ছবি, CSS ও আগের JavaScript অক্ষত রাখা হয়েছে। নতুন Student Portal, Admin Dashboard, Gallery Management এবং Supabase database setup-এর ফাইল যোগ করা হয়েছে।

## কী কী যোগ হয়েছে

- `portal.html`: Student/Admin Login এবং Student account registration
- `admin-dashboard.html`: Student, Payment, Gallery, Website Editor, Admin Account ও Activity panels
- `assets/`: Supabase client, portal/admin logic, আলাদা portal styling, home banner CMS এবং dynamic gallery loader
- `supabase/schema.sql`: Database tables, Row Level Security (RLS), Storage buckets ও access policies
- পুরোনো public pages-এ Student Login link যোগ হয়েছে
- Home Page-এর banner title/subtitle, banner image ও primary color-এর সীমিত Simple Editor

## গুরুত্বপূর্ণ: ZIP upload করলেই backend চালু হবে না

এটি static website ছিল। Login, private student records, payment review এবং gallery uploads চালু করতে ক্লাবের দায়িত্বশীল প্রাপ্তবয়স্ক/ম্যানেজমেন্টের নামে Supabase project তৈরি ও configure করতে হবে। এই ZIP-এ কোনো password, secret key বা payment gateway credential নেই।

## Setup (ক্লাবের দায়িত্বশীল Admin করবেন)

1. Supabase-এ একটি project তৈরি করুন।
2. Supabase Dashboard → SQL Editor → New Query খুলুন।
3. এই ZIP-এর `supabase/schema.sql` ফাইলের সম্পূর্ণ SQL paste করে Run করুন।
4. `assets/supabase-config.js` খুলুন। Supabase → Project Settings → API থেকে **Project URL** এবং **Publishable Key (`sb_publishable_...`)** বসান।
   - `YOUR_SUPABASE_PROJECT_URL` বদলে Project URL দিন।
   - `YOUR_SUPABASE_ANON_PUBLIC_KEY` বদলে Publishable Key (`sb_publishable_...`) দিন।
   - **Secret Key (`sb_secret_...`) বা service_role key কখনো এখানে বা GitHub-এ দেবেন না।**
5. Website deploy করে `portal.html` খুলুন। প্রথম Main Admin-এর জন্য একটি account Sign Up করুন।
6. Supabase → Authentication → Users-এ account email confirmed হয়েছে কি না দেখুন। Email confirmation চালু থাকলে email verify করুন।
7. Supabase SQL Editor-এ এই query চালিয়ে প্রথম Main Admin activate করুন (নিজের account-এর email বসাবেন):

```sql
update public.profiles
set role = 'main_admin', status = 'active'
where id = (
  select id from auth.users
  where email = 'MAIN-ADMIN-EMAIL@example.com'
);
```

8. `portal.html`-এ ওই account দিয়ে Login করলে Admin Dashboard খুলবে।
9. অন্য দুই Admin-কে আগে `portal.html` থেকে নিজেদের account Sign Up করতে হবে। Main Admin → Admin Accounts tab থেকে সর্বোচ্চ ২টি account-কে Admin role দিতে পারবেন।
10. Students tab থেকে আগে থেকে থাকা শিক্ষার্থীদের Roll, Name, Batch, Belt ও monthly fee দিয়ে add করুন। Student account-এ দেওয়া requested Roll Number মিলে গেলে Main Admin-এর মাধ্যমে account link/activate হবে।

## Payment verification

- Student portal-এ শিক্ষার্থী payment month, amount, method, sender number, Transaction ID এবং optional proof জমা দিতে পারবে।
- Proof file private `payment-proofs` bucket-এ থাকবে।
- Admin Dashboard → Payments থেকে proof খুলে Approve/Reject করা যাবে।
- Student নিজের payment history ও status দেখতে পারবে।
- bKash/Nagad নম্বর ক্লাবের ম্যানেজমেন্টের কাছ থেকে যাচাই করে শিক্ষার্থীদের জানাতে হবে। ZIP-এ কোনো নতুন Nagad নম্বর অনুমান করে দেওয়া হয়নি।
- Card payment এখনো যুক্ত নয়। পরে অনুমোদিত payment gateway ও merchant onboarding লাগবে।

## Gallery ও Facebook

- Admin ছবি/ভিডিও upload করতে পারবেন; Gallery page-এ published item দেখা যাবে।
- Facebook post/video URL gallery item হিসেবে যোগ করা যায়।
- Facebook Page-এর album automatic sync করা হয়নি। Meta developer app, Page permissions ও token review প্রয়োজন হতে পারে।

## Security notes

- Database-এ RLS enabled; Student নিজের linked record ও payment history-ই পড়তে পারবে।
- Payment proof bucket private; public gallery আলাদা।
- প্রথম Main Admin SQL Editor দিয়ে bootstrap করতে হয়; public signup দিয়ে কেউ Admin হতে পারে না।
- Main Admin-ই অন্য Admin role নিয়ন্ত্রণ করেন। মোট কাঠামো: ১ Main Admin + সর্বোচ্চ ২ Admin।
- Supabase project ও payment account ক্লাবের দায়িত্বশীল প্রাপ্তবয়স্ক/ম্যানেজমেন্টের নিয়ন্ত্রণে রাখুন।
- বাস্তব ছাত্রদের তথ্য, ফোন নম্বর, guardian details ও ছবি যোগের আগে ক্লাবের অনুমতি নিন; অপ্রাপ্তবয়স্ক শিক্ষার্থীদের ছবি প্রকাশে অভিভাবকের সম্মতি নিশ্চিত করুন।

## Deploy

- ZIP extract করে সম্পূর্ণ project GitHub repository-তে upload করুন।
- Vercel-এ ওই repository deploy করুন।
- Domain এখন প্রয়োজন নেই; বর্তমান Vercel URL দিয়েই preview/test করা যাবে।
- প্রথমে test accounts ও dummy payment দিয়ে পরীক্ষা করুন। সব test pass এবং ক্লাবের Admin অনুমোদন না পাওয়া পর্যন্ত production-এ বাস্তব student data/payment ব্যবহার করবেন না।

## সীমাবদ্ধতা / পরবর্তী উন্নয়ন

- Website Editor এখন Home Banner title, subtitle, image এবং primary color নিয়ন্ত্রণ করে। পুরো website-এর সব লেখা, সব ছবি, section reorder/drag-and-drop এখনো নেই।
- Admin permission এখন role-based: সাধারণ Admin Student, Payment, Gallery, Content ও Activity পরিচালনা করতে পারে; Admin role তৈরি/পরিবর্তন শুধু Main Admin পারে।
- Sensei-এর জন্য আলাদা role এখনো যোগ করা হয়নি।
- Card gateway, automatic Facebook API sync, password reset email branding এবং advanced audit reporting আলাদা configuration/পরীক্ষা চায়।


## Developer Account ও Role Setup (গুরুত্বপূর্ণ)
- Developer-এর নির্ধারিত website email: `mdihsanahmadr10@gmail.com`।
- প্রথমে এই ইমেইল দিয়ে Supabase Auth-এ account তৈরি/verify করতে হবে।
- এরপর SQL Editor-এ schema-এর শেষে থাকা Developer Bootstrap UPDATE query চালাতে হবে। এতে এই profile-টি `developer` হবে এবং full access পাবে।
- Public signup form থেকে কেউ Developer হতে পারবে না। Login page-এ Student, Sensei, Trainer, Developer ও Admin option দেখা গেলেও backend profile-এর অনুমতি ছাড়া কোনো access পাওয়া যাবে না।
- Developer dashboard থেকে সর্বোচ্চ ২টি সাধারণ Admin account অনুমোদন করা যাবে। Admin-এর ইমেইল দিয়ে আগে signup করিয়ে, Developer review করে Admin role দিতে হবে।
- Sensei/Trainer-দের role-ও Developer/authorized admin-ই দিতে পারবেন।

## Club Contact ও Notification Email
- Public website contact email: `osmanikarateclubsylhet@gmail.com`
- Website notification/Developer approval email: `mdihsanahmadr10@gmail.com`
- Contact/WhatsApp number: `01325-505488` (WhatsApp international link uses `+8801325505488`)
- ইমেইলে স্বয়ংক্রিয় notification পাঠাতে Supabase Edge Function এবং email provider (যেমন Resend) configure করতে হবে। শুধু HTML/JavaScript-এ Gmail address বসালে automatic email যায় না। Gmail password কখনো website বা GitHub-এ দেবে না।


## এই প্যাকেজ ব্যবহারের আগে অবশ্যই পড়ুন

- মূল ওয়েবসাইটের বিদ্যমান HTML/CSS/ছবি/লোগো অপরিবর্তিত রাখা হয়েছে; নতুন Portal/Admin ফাইল আগের প্যাকেজের মতোই অন্তর্ভুক্ত।
- মূল public pages-এ থাকা ভাষা switcher-এর অনুবাদ কেবল `data-key` দিয়ে চিহ্নিত লেখা বদলায়। Portal/Admin-এর প্রতিটি লেখা এখনো সম্পূর্ণ bilingual নয়; তাই পুরো সাইটে শতভাগ বাংলা/English switch কার্যকর বলে ধরে নেবেন না।
- `schema.sql`-এ থাকা SQL আগের Supabase database-এর সঙ্গে যাচাই না করে আবার চালাবেন না। আগে database backup নিন এবং test project-এ পরীক্ষা করুন।
- Admin/Developer access bootstrap এবং RLS policies production-এ চালুর আগে ক্লাবের দায়িত্বশীল প্রাপ্তবয়স্ক/অনুমোদিত Admin দিয়ে যাচাই করান।
- এই ZIP-এর Supabase URL ও Publishable Key browser-safe key; তবু RLS ছাড়া database নিরাপদ নয়। কোনো Secret Key, database password বা user password এখানে নেই।
- ZIP upload করার আগে GitHub repository-র বর্তমান ফাইল backup/Download ZIP করে রাখুন। সরাসরি পুরোনো সব ফাইল delete করবেন না; প্রথমে test deployment করুন।


## Main Admin ও Admission Form Migration (Existing Database)

1. Supabase Dashboard → SQL Editor খুলে `supabase/main-admin-and-admission-migration.sql`-এর SQL একবার চালাও। আগে Database backup নাও।
2. Result-এ `mdihsanahmad815@gmail.com`-এর Role `main_admin` এবং Status `active` দেখাতে হবে।
3. Supabase → Authentication → Sign In / Providers → Email-এ গিয়ে Confirm email বন্ধ করলে নতুন শিক্ষার্থীরা ইমেইল confirmation ছাড়াই লগইন করতে পারবে। এটি ক্লাবের দায়িত্বশীল প্রাপ্তবয়স্ক/অফিসিয়াল ব্যক্তির অনুমোদন নিয়ে করো; email confirmation চালু থাকলে confirmation লাগবেই।
4. Student profile photo private `student-photos` bucket-এ থাকে। Student শুধু নিজের তথ্য/ছবি দেখতে পারবে; Staff RLS policy অনুযায়ী দেখতে পারবে।
5. Public signup থেকে Admin/Main Admin role দেওয়া যায় না। Main Admin Dashboard থেকেই পরবর্তী Admin নিয়োগ করবে।

**সতর্কতা:** SQL migration চালানোর আগে backup নাও এবং Supabase-এ ফলাফল যাচাই করো। এই ZIP স্থানীয়ভাবে package ও syntax-level checks করা হয়েছে; live Supabase project-এ deploy বা end-to-end test করা হয়নি।
