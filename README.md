# Broadcast

A small internal tool: upload content once, get quick AI-style suggestions,
then check off each social channel as you post to it manually. Each team
member logs in and manages their own list of channels.

## 1. Create a Supabase project (free)

1. Go to https://supabase.com, sign in, and click "New project."
2. Once it's created, open **SQL Editor** in the left sidebar, paste in the
   contents of `supabase/schema.sql` from this repo, and click **Run**.
   This creates the `accounts` table and locks it down so each person only
   sees their own channels.
3. Go to **Project Settings -> API**. Copy the **Project URL** and the
   **anon public** key — you'll need both in the next step.
4. Still in Supabase, go to **Authentication -> Providers** and make sure
   **Email** is enabled (it is by default). Optionally, under
   **Authentication -> Settings**, turn off "Confirm email" if you want
   teammates to be able to sign in immediately without a confirmation email.

## 2. Run it locally (optional, to test before deploying)

```bash
npm install
cp .env.example .env
# paste your Supabase URL and anon key into .env
npm run dev
```

## 3. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

(`.env` is already excluded via `.gitignore` — your Supabase keys never get
committed. You'll set them directly in Render instead.)

## 4. Deploy on Render

1. In Render, click **New -> Static Site** and connect this GitHub repo.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Under **Environment**, add two environment variables:
   - `VITE_SUPABASE_URL` — your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` — your Supabase anon public key
5. Deploy. Every future `git push` to `main` will auto-redeploy.

## How team members use it

Each teammate goes to the Render URL, signs up with their own email, and
adds their own Facebook/Instagram/YouTube/TikTok/Facebook Group pages under
"Your connected channels." Nobody sees anyone else's channel list — that's
enforced by the row-level security policy in `schema.sql`, not just the UI.

## What this does and doesn't do

- It does NOT auto-post to any platform. You still post manually — this is
  a content-prep and tracking tool, not an auto-publisher.
- It does NOT persist the current draft/checklist between sessions yet —
  refreshing clears the current post's checked-off state. A natural next
  step would be a `posts` table if you want a saved history of past posts.
