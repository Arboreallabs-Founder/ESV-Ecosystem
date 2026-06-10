# Supabase Setup Guide — ESV Ecosystem App

This guide tells you everything you need to connect this project to the existing Supabase Cloud project on a new machine.

---

## 1. Project Details

| Item | Value |
|---|---|
| **Project Name** | ESV Ecosystem |
| **Project ID** | `hsabrzwsetjeaqutjrjb` |
| **Region** | ap-south-1 (Mumbai) |
| **Dashboard URL** | https://supabase.com/dashboard/project/hsabrzwsetjeaqutjrjb |

---

## 2. What You Need to Get

You need two values from the Supabase dashboard. Here's exactly where to find them:

### 2a. `NEXT_PUBLIC_SUPABASE_URL`

1. Go to: https://supabase.com/dashboard/project/hsabrzwsetjeaqutjrjb/settings/api
2. Under **Project URL**, copy the value (looks like `https://hsabrzwsetjeaqutjrjb.supabase.co`)

### 2b. `NEXT_PUBLIC_SUPABASE_ANON_KEY`

1. Same page: https://supabase.com/dashboard/project/hsabrzwsetjeaqutjrjb/settings/api
2. Under **Project API Keys**, copy the `anon` `public` key (long string starting with `eyJ...`)

---

## 3. Create Your `.env.local` File

In the root of this repo, create a file called `.env.local` (it is git-ignored):

```
NEXT_PUBLIC_SUPABASE_URL=https://hsabrzwsetjeaqutjrjb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste the anon key here>
```

Replace `<paste the anon key here>` with the key you copied in step 2b.

---

## 4. Install Dependencies and Run

```bash
npm install
npm run dev
```

The app runs at http://localhost:3000.

---

## 5. Google OAuth (if you need to test login)

Google OAuth is already configured for the production URL (`https://ecosystem-liart.vercel.app`). If you want Google login to also work on `localhost:3000`:

1. Go to: https://supabase.com/dashboard/project/hsabrzwsetjeaqutjrjb/auth/url-configuration
2. Under **Redirect URLs**, add: `http://localhost:3000/auth/callback`

---

## 6. Supabase CLI (optional, for local DB work)

If you want to use the Supabase CLI on this machine:

```bash
npm install -g supabase
supabase login
```

After `supabase login` it will open a browser tab asking you to authorise with your Supabase account.

To link to the existing project:

```bash
supabase link --project-ref hsabrzwsetjeaqutjrjb
```

It will ask for your database password. To get/reset it:
1. Go to: https://supabase.com/dashboard/project/hsabrzwsetjeaqutjrjb/settings/database
2. Under **Database password**, click **Reset database password** if you don't know it.

---

## 7. Quick Checklist

- [ ] Got `NEXT_PUBLIC_SUPABASE_URL` from API settings
- [ ] Got `NEXT_PUBLIC_SUPABASE_ANON_KEY` from API settings  
- [ ] Created `.env.local` in repo root with both values
- [ ] Ran `npm install`
- [ ] Ran `npm run dev` — app loads at http://localhost:3000
- [ ] (Optional) Added `http://localhost:3000/auth/callback` to Supabase redirect URLs for Google login
