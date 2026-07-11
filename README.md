# Q8_ULTRA — web app

Kuwait trail runners: race boards, start lists, announcements, gear wall.
React + Vite frontend, Supabase (Postgres + Auth) backend. No Claude account needed.

Security is enforced by the database, not the browser:
- Members can only create/edit/withdraw **their own** race entries.
- "Hide my name" entries are masked **server-side** — other members receive the
  literal string `Private runner`; the real name never leaves the database.
- Only director accounts can post/delete announcements or remove others' content.
- Passwords are handled by Supabase Auth (bcrypt, reset emails, session tokens).

---

## 1. One-time database setup (5 minutes)

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Paste the entire contents of `supabase/schema.sql` → **Run**.
   This creates all tables, the security policies, and pre-loads the race calendar.
3. **Authentication → Sign In / Providers → Email**: turn **OFF** "Confirm email".
   (Recommended: members can join instantly. Leave it ON if you want verified
   emails — new members will then get a confirmation email before first sign-in.)

## 2. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 — the Supabase URL and publishable key are already in `.env`.

## 3. Make yourself director

1. Create your account in the app first (sign up with your email).
2. Supabase → SQL Editor → run (with your email):

```sql
update public.profiles set is_director = true
where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');
```

Refresh the app — the shield icon appears and the announcements composer unlocks.
Run the same statement for anyone else you want as co-director; set `false` to revoke.

## 4. Deploy (Vercel, free)

1. Push this folder to a GitHub repository.
2. vercel.com → **Add New… → Project** → import the repo.
3. In the project's **Environment Variables**, add both values from `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. **Deploy**. Your app is live at `https://<project>.vercel.app` — share that
   link in the group WhatsApp. Add a custom domain later under
   Settings → Domains if you want `q8ultra.com`.

CLI alternative: `npm i -g vercel && vercel` from this folder.

Netlify works identically (import repo, set the same two env vars,
build command `npm run build`, publish directory `dist`).

## Notes

- The key in `.env` is Supabase's **publishable** key — it is designed to be
  public and is safe inside the frontend. All protection comes from the
  Row Level Security policies in `schema.sql`. Never put a `service_role`
  key in this project.
- Phone-number sign-in requires a paid SMS provider; the app uses email
  sign-in instead, and phone numbers can be shared as contact info on wall posts.
- Race dates were verified on 11 Jul 2026. Add/remove races from inside the app.
- To wipe test data: Supabase → Table Editor → truncate `entries`,
  `wall_posts`, `announcements` (leave `events` and `profiles`).
