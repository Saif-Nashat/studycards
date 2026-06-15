# 📱 Putting StudyCards online (free) so your iPad can use it

**Honest heads-up:** this is the one part that's a bit technical. The good news: it's
free, and **when you're back I can do the technical bits with you** — you'll mostly just
create a couple of free accounts and paste a few things. This guide is the map; we can
walk it together.

There are two ways to use the app away from your laptop:

---

## Option A — Quick & free, same home Wi-Fi only (5 minutes)
If your iPad and laptop are on the **same Wi-Fi**, you can use the app on the iPad with
*no hosting at all*:

1. On the laptop, double-click **`Start StudyCards`**.
2. The black window shows a line like `Network: http://192.168.x.x:3000`.
3. On your iPad's browser, type that exact address.

Downsides: the laptop must be **on and awake** on the same Wi-Fi. Good for home revision,
not for the hospital/commute.

---

## Option B — Proper hosting (works anywhere, including hospital Wi-Fi & data)
This puts the app on the internet at a private link only you can log into. All free.
We use two free services: **Neon** (the database) and **Vercel** (runs the app).

### Step 1 — Create the free database (Neon)
1. Go to **neon.tech** → sign up (free, use your Google account).
2. Create a new project (any name). 
3. Copy the **connection string** it gives you (starts with `postgresql://...`). Keep it safe.

### Step 2 — Switch the app to the cloud database
In the `studycards` folder, open `prisma/schema.prisma` and change this one line:
```
provider = "sqlite"
```
to:
```
provider = "postgresql"
```
Save the file. *(This is the kind of step I'll just do for you.)*

### Step 3 — Load the tables into the cloud database (one time)
1. Open `.env` and temporarily set:
   ```
   DATABASE_URL="<paste your Neon connection string here>"
   ```
2. Double-click **`First-time setup`** (or run `npm run setup`). This creates the tables
   and starter cards inside your cloud database.

### Step 4 — Put the code on GitHub
1. Create a free account at **github.com**.
2. Easiest: install **GitHub Desktop** (desktop.github.com), click *Add → Add existing
   repository*, choose the `studycards` folder, then *Publish repository* (set it to
   **Private**).

### Step 5 — Deploy on Vercel
1. Go to **vercel.com** → sign up with your GitHub account.
2. Click **Add New → Project**, pick the `studycards` repository, click **Import**.
3. Before clicking Deploy, open **Environment Variables** and add three:
   | Name | Value |
   |---|---|
   | `DATABASE_URL` | your Neon connection string |
   | `APP_PASSWORD` | a password you choose |
   | `SESSION_SECRET` | a long random string (mash the keyboard) |
4. Click **Deploy**. After ~2 minutes you get a link like `https://studycards-xxx.vercel.app`.

### Step 6 — Use it on your iPad
Open that link in Safari, log in with your `APP_PASSWORD`, and add it to your Home Screen
(Share → *Add to Home Screen*) so it feels like a real app. 🎉

---

## Loading big USMLE decks when hosted
Very large `.apkg` files can be too big to upload through the website. To load a big deck
into your **cloud** database:
1. On the laptop, set `.env`'s `DATABASE_URL` to your Neon string (as in Step 3).
2. Start the app locally and import the big `.apkg` as usual — it writes straight into the
   cloud database, so it instantly appears on your iPad too.

Small claude.ai card imports work fine directly on the website.

---

## When you're back
Tell me you're ready to deploy and I'll guide you click-by-click and handle the file edits
and commands myself. You just bring the two free accounts.
