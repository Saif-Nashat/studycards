# 🚀 Full hosting walkthrough (GitHub + Vercel + Neon)

Goal: put StudyCards online (free) so your iPad can use it, sharing one database with your laptop.
🟢 = you do it · 🔵 = Claude does it here in the chat.

No domain needed (you get a free `*.vercel.app` link). No app install on the iPad (just open the link).

---

## PHASE 1 — Free database on Neon
🟢 **You:**
1. Go to **neon.tech** → **Sign up** (Google or email; no card needed).
2. Let it create a project. If asked: name **studycards**, region nearest you, defaults otherwise.
3. Open **Connect** (or "Connection string"). If offered **Pooled** vs Direct, pick **Pooled**.
4. Make sure the password is shown (toggle "Show password"), then **copy** the whole
   `postgresql://…` string.
5. **Paste it into the chat.**

🔵 **Me (after you paste it):**
- Switch the app from the local file database to your Neon database.
- Create all the tables in Neon and load your 12 starter cards.
- Run the app locally pointed at Neon to confirm it works.

---

## PHASE 2 — Get the code onto GitHub
🟢 **You — make the account (if not done):**
1. **github.com** → **Sign up** → username, your email, password, verify email.

🟢 **You — install the uploader:**
2. Download **GitHub Desktop** from **desktop.github.com** → install → open → **Sign in** with
   your new GitHub account.

🔵 **Me:** prepare the project as a git repository and make the first commit (so it's ready to publish).

🟢 **You — publish:**
3. In GitHub Desktop: **File → Add local repository** → browse to
   `Desktop\Mayoosa\studycards` → **Add**.
4. Click **Publish repository** (top right). 
   - Keep the name **studycards**.
   - ✅ Tick **"Keep this code private"**.
   - Click **Publish repository**.

✅ Your code is now on GitHub. (Your password/secrets are NOT uploaded — they're ignored on purpose.)

---

## PHASE 3 — Deploy on Vercel
🟢 **You:**
1. Go to **vercel.com** → **Sign up** → choose **Continue with GitHub** (links the accounts).
2. Approve GitHub access when asked (you can allow just the `studycards` repo).
3. Click **Add New… → Project**.
4. Find **studycards** in the list → **Import**.
5. It detects **Next.js** automatically — don't change build settings.
6. Open **Environment Variables** and add these three (I'll give you the exact values to paste):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | *(your Neon string — I'll confirm it)* |
   | `APP_PASSWORD` | `Saif-2001` |
   | `SESSION_SECRET` | `160a63e00e5bf5cc48f697294710a8c31cbf522ab5baef7b45b1f5be96ba17e9` |

7. Click **Deploy** and wait ~2 minutes.
8. When it says **"Congratulations"**, click **Continue to Dashboard** → copy your link
   (looks like `https://studycards-xxxx.vercel.app`). **Paste it to me so I can test it.**

---

## PHASE 4 — Use it on your iPad
🟢 **You:**
1. Open the Vercel link in **Safari** on the iPad.
2. Log in with password **`Saif-2001`**.
3. Tap the **Share** button → **Add to Home Screen** → it gets an app icon. Done! 🎉

---

## After it's live — good to know

**Studying on laptop AND iPad:** both now use the same online database, so progress syncs.
To run the laptop version against the online database, just keep using `Start StudyCards`
(it already points at Neon after Phase 1).

**Importing big Anki decks (AnKing etc.):** if a deck is too big to upload on the website,
import it from the **laptop** app instead — it writes to the same online database, so it
shows up on the iPad too.

**Changing your password later:** change `APP_PASSWORD` in Vercel
(Project → Settings → Environment Variables) and click **Redeploy**.

**If we improve the app later:** I update the files, you click **"Commit"** then **"Push"**
in GitHub Desktop, and Vercel auto-updates the live site in ~2 minutes.

---

## Troubleshooting
- **Vercel build fails:** paste me the red error text — usually a missing environment variable.
- **"Internal Server Error" on the site:** almost always the `DATABASE_URL` is wrong/incomplete —
  re-copy the full Neon pooled string (with password) into Vercel and redeploy.
- **Can't log in:** check `APP_PASSWORD` in Vercel is exactly `Saif-2001` (capital S).
