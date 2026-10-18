# UBEI ShareHub

UBEI-এর Facebook পোস্ট পরিকল্পনা, staff share assignment, link submission, manual verification ও মাসিক reporting-এর একটি single-institution internal application। **শুরু করুন `START-HERE.html` দিয়ে।**

## Engineering decision

Next.js-এ rewrite করা হয়নি। এই authenticated internal application-এ SEO/SSR দরকার নেই; supplied UI native JavaScript-এই সম্পূর্ণ কাজ করছিল। Vite + native ES modules + Supabase বেছে নেওয়া হয়েছে। এতে বর্তমান features রাখা গেছে, shared code একবার বদলানো যায় এবং frontend static hosting-এ চলে। ভবিষ্যতে React/Next.js নেওয়ার প্রয়োজন হলে domain rules, schema ও service layer পুনর্ব্যবহারযোগ্য।

এটি multi-tenant commercial SaaS নয়। অন্য প্রতিষ্ঠানকে একই database-এ যুক্ত করতে হলে organization membership এবং organization-scoped permissions যোগ করতে হবে।

## Local run

Node.js 22 LTS (22.12+) বা 24 LTS install করুন। ZIP extract করে project folder-এ terminal খুলুন:

```sh
npm ci
npm run dev
```

খুলুন terminal-এ দেখানো URL, তারপর `/admin.html` বা `/moderator.html`। কোনো credentials না দিয়ে localhost-এ চালালে পরিষ্কার **DEMO** banner এবং sample accounts দেখা যাবে। এটি আসল shared database নয়। Live mode কখনো demo account seed করে না।

## Supabase connection

1. নতুন Supabase Free project তৈরি করুন। আপনার project reference/URL সংরক্ষণ করুন।
2. SQL Editor-এ `supabase/migrations/001_sharehub.sql`, তারপর `002_media_and_realtime.sql` একবার করে চালান। একই migration পুনরায় চালাবেন না। এগুলো নতুন project-এর জন্য; existing unrelated database-এ না চালানোই সুবিধাজনক।
3. Authentication → Users → Add user দিয়ে নিজের email ও একটি শক্ত password দিন; email confirmed/auto confirm নির্বাচন করুন। Authentication settings-এ public signup বন্ধ রাখুন।
4. `supabase/bootstrap.sql`-এর `REPLACE_WITH_YOUR_EMAIL` নিজের সেই email দিয়ে বদলান। SQL Editor-এ একবার চালিয়ে প্রথম Super Admin বানান।
5. Account management-এর Edge Function deploy করুন:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy manage-user --project-ref YOUR_PROJECT_REF
```

প্রয়োজনে CLI authentication browser-এ নিজের account দিয়ে সম্পন্ন করুন। Hosting provider-এ এই command চালানোর প্রয়োজন নেই। Supabase-hosted Edge Function-এ `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` built-in server environment থেকে পাওয়া যায়। `verify_jwt=false` রাখা হয়েছে কারণ function নিজেই bearer token `auth.getUser()` দিয়ে যাচাই করে, তারপর database থেকে active admin role পরীক্ষা করে।

6. `.env.example` কপি করে `.env` বানান। Project settings/Connect থেকে URL ও **publishable key** দিন। পুরোনো project হলে legacy `anon` key-ও ব্যবহার করা যাবে।

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
VITE_ENABLE_DEMO=false
```

`service_role` বা secret key এখানে, GitHub-এ, Vercel/Cloudflare-এর `VITE_` variable-এ বা browser code-এ দেবেন না। Publishable key frontend-এ visible থাকাটা স্বাভাবিক; access database permissions/RPC checks দিয়ে সুরক্ষিত।

7. Dev server restart করুন। `/admin.html`-এ email ও password দিয়ে login করুন। নিজের account-এ লগইন করে moderator/admin যোগ করুন। প্রত্যেকের valid email এবং অন্তত 10-character password প্রয়োজন। Username display-এর জন্য; live login email দিয়ে হয়।

## সম্পূর্ণ free deployment-এর প্রস্তাব

**Cloudflare Pages Free + Supabase Free।** Vercel-এর Hobby plan personal non-commercial use-এর জন্য; UBEI-এর organizational marketing operations-এর জন্য Hobby eligibility ধরে নেওয়া ঠিক হবে না। Vercel চাইলে তাদের eligible plan/approval ব্যবহার করুন। একই source দুই provider-এ deploy করা যাবে।

### Cloudflare Pages

Private GitHub repository-তে source upload করুন; `node_modules`, `.env`, personal exports বা real data upload করবেন না। Cloudflare → Workers & Pages → Create → Pages → Import Git repository:

- Framework: Vite / None
- Build command: `npm run build`
- Build output directory: `dist`
- Root: project root (যেখানে `package.json` আছে)
- Node version: 22 বা 24
- Environment variables: উপরের দুই public `VITE_SUPABASE_*` values; `VITE_ENABLE_DEMO=false`

Deploy করুন। প্রথমবার পাওয়া `https://YOUR_SITE.pages.dev/admin.html` দিয়ে login করুন। Moderator link: একই domain-এর `/moderator.html`। Root URL admin login-এ নিয়ে যায়। নিজের domain কেনার প্রয়োজন নেই।

GitHub ছাড়াও `.env` দিয়ে local `npm run build` চালিয়ে Cloudflare Pages Direct Upload-এ শুধু `dist` folder দিতে পারেন। পরের update-গুলোও manual upload করতে হবে; Git integration হলে push থেকেই deploy হবে।

### Vercel configuration

Eligible Vercel account/plan-এ Git repository import করুন। Framework Vite; root project root; output `dist`; Node 22/24; একই public environment variables দিন। `vercel.json` build ও security headers প্রস্তুত করে রেখেছে। Environment variable বদলালে **redeploy/rebuild** লাগবে।

Vercel free eligibility verified হলে non-commercial prototype চালানো সম্ভব; UBEI operational use-কে বিনা যাচাইয়ে Hobby-তে চালানোর নির্দেশ দেওয়া হচ্ছে না।

## Free plan-এর সীমা (checked 17 October 2026)

- Supabase Free: 500 MB database, 1 GB file storage, 50,000 monthly active users, 5 GB egress + 5 GB cached egress, 500,000 Edge Function invocations, 200 peak Realtime connections / 2 million monthly messages।
- Free project প্রায় এক সপ্তাহ inactive থাকলে pause হতে পারে। Dashboard থেকে resume করতে হয়। Free-তে automatic database backup/PITR নেই। সবসময় uptime বা আজীবন একই quota নিশ্চিত নয়।
- Cloudflare Pages Free: 500 builds/month; frontend static assets। Supabase traffic আলাদাভাবে Supabase quota ব্যবহার করে।
- Default Supabase email service-এর recipient/rate সীমা আছে। এই setup-এ staff accounts admin সরাসরি তৈরি করে, temporary credentials নিজে দেন; paid SMTP লাগে না। User নিজে password বদলাতে পারে; ভুলে গেলে admin reset করে দেবেন। Password-reset email flow যোগ করা হয়নি।
- ছোট UBEI staff team-এর জন্য free quota দিয়ে শুরু করা বাস্তবসম্মত। প্রকৃত খরচ usage-এর ওপর নির্ভর করে; storage/egress monitor করুন। কোনো paid AI, SMS, Facebook Graph API বা email subscription দরকার হয় না।

## Daily workflow

Super Admin/admin Facebook page details, groups ও moderators যোগ করবেন। Post title/date/time/caption/image এবং আসল Facebook page post URL দিন। কোন staff নিজের profile বা কোন group-এ share করবে নির্ধারণ করুন। সময়গুলো **Asia/Dhaka**।

Moderator Facebook-এ **নিজে** share করে নিজের shared post link জমা দেবে। App Facebook-এ publish করে না, background auto-share করে না এবং Facebook login/access token নেয় না। Admin link খুলে manually যাচাই করবেন। Broken/private/wrong post হলে reason দিয়ে reject করবেন। Resubmit করলে আবার Pending হবে। Duplicate task/link server-এও আটকানো আছে।

## Backup এবং restore

Super Admin → Settings → Export JSON। Export-এ normalized business records ও staff metadata থাকে; password/session থাকে না। Images-এর durable `storage:` references থাকে, expiring signed URL নয়। Export ব্যক্তিগতভাবে সংরক্ষণ করুন। Storage-এর image files আলাদা; সেগুলো Supabase Storage থেকে আলাদা download করতে হবে। JSON export একা সম্পূর্ণ media/Auth backup নয়।

Restore একটি reviewable offline ধাপ:

```sh
node scripts/restore-sql.mjs my-backup.json restore.sql
```

এটি SQL **ফাইল তৈরি করে**, কোনো server-এ পরিবর্তন করে না। SQL review করে Supabase SQL Editor-এ চালাতে হবে। Restore-এর সময় posts/shares/groups খালি থাকতে হবে, এবং referenced staff accounts/profile IDs থাকতে হবে। Existing data মুছে এই script শুরু করে না।

নতুন project-এ Auth users আবার তৈরি করলে UUID আলাদা হবে। `{"OLD_UUID":"NEW_UUID"}` mapping JSON বানিয়ে দিন:

```sh
node scripts/restore-sql.mjs my-backup.json restore.sql user-id-map.json
```

তারপর আগের storage paths-এ media restore করুন; UUID পরিবর্তিত হলে `storage:` references/path-ও reviewed migration দিয়ে ঠিক করতে হবে। পুরোনো localStorage JSON-এর login/password hashes cloud Auth-এ import করবেন না; নতুন secure accounts তৈরি করে business data আলাদা migrate করতে হবে। Original uploaded HTML files পরিবর্তন করা হয়নি।

## Changes later

| কী বদলাবেন | ফাইল |
|---|---|
| Admin pages/features | `src/apps/admin.js` |
| Moderator pages/features | `src/apps/moderator.js` |
| Shared rendering/forms/lifecycle | `src/core/application.js` |
| Facebook URL, CSV, Dhaka time rules | `src/lib/domain.js` |
| Supabase auth, row mapping, save/sync, media | `src/services/cloud.js` |
| Cloud-specific login/member/settings actions | `src/services/cloud-ui.js` |
| Bangla strings | `src/i18n/messages.js` |
| Layout and component styles | `src/styles/app.css` |
| Dark contrast/accessibility overrides | `src/styles/accessibility.css` |
| Server permissions/schema | নতুন numbered SQL migration যোগ করুন |
| Account service | `supabase/functions/manage-user/index.ts` |

Workflow: source edit → tests → local review → `npm run build` → Git push/deploy। Database change হলে নতুন migration দিন; old migration rewrite করে existing project-এ পুনরায় চালাবেন না। Account service বদলালে Edge Function আলাদাভাবে redeploy করতে হবে।

## Verification

```sh
npm test
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
node tests/cloud-browser.mjs
```

`tests/schema.test.mjs`: embedded real PostgreSQL/PGlite-তে schema, RLS/grants, role denial, private contact isolation, future posts, atomic writes, duplicate shares, optimistic concurrency। `tests/browser.mjs`: browser-এ both panels, light/dark, flows, mobile এবং visible control contrast। `tests/cloud-browser.mjs`: real SDK + real PostgreSQL RPC integration, **local Auth HTTP test double**।

এই delivery-তে আপনার live project credentials/access দেওয়া হয়নি। Hosted Supabase Auth/Storage/Realtime/Edge Function, actual deployment URL, production headers এবং আপনার staff-এর দুই device দিয়ে final smoke test **setup-এর পর করতে হবে**। Local tests-কে live deployment test বলা হচ্ছে না।

## First live smoke test

নিজে admin হিসেবে login করুন; আলাদা browser/device-এ moderator হিসেবে login করুন। একটি test group/post তৈরি করুন; profile/group assignment দিন; moderator share URL জমা দিক; admin verify/reject করুন; দুই device-এ refresh দিয়ে ফল মিলিয়ে দেখুন। Profile photo/post image upload করে private signed media খুলছে কি না দেখুন। Moderator deactivate করে access বন্ধ হচ্ছে কি না দেখুন। সফল হলে test records পরিষ্কার করে daily operation শুরু করুন।

## Sources

- https://vercel.com/docs/plans/hobby
- https://vercel.com/docs/limits/fair-use-guidelines
- https://supabase.com/pricing
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/functions/auth
- https://supabase.com/docs/reference/javascript/auth-admin-createuser
- https://www.cloudflare.com/products/pages/
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/pages/get-started/git-integration/
