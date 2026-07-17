# 🩺 StudyCards — How to use it (start here)

This is your private flashcard app for MRCOG Part 1 and USMLE Step 1/2.
No coding needed. Just follow the steps.

---

## ▶️ 1. Start the app (on your laptop)

1. Open the folder: `Desktop → Mayoosa → studycards`
2. **Double-click** the file called **`Start StudyCards`**.
3. A black window opens (that's normal — **leave it open**). After a few seconds your browser opens the app by itself.
   - If the browser shows an error, wait 5 seconds and refresh the page.
4. To **stop** the app later, just close that black window.

> First time only: if double-clicking `Start StudyCards` doesn't work, double-click **`First-time setup`** once, wait for it to finish, then use `Start StudyCards`.

---

## 🔑 2. Log in

- The app has **7 separate accounts** (each with its own decks, progress,
  notebook and storage share). Sign in with your **username + password** —
  the full list lives in `USERS-AND-PASSWORDS.md` one folder up (kept out of
  GitHub on purpose).
- To change a password: edit `scripts/setup-users.mjs` and run
  `npm run users -- --reset-passwords` inside the `studycards` folder.

---

## 🧠 3. The 5 screens

| Screen | What it does |
|---|---|
| **Home** | See what's due, your decks, and start studying. |
| **Study** | Shows a question → click **Show Answer** → rate **Again / Hard / Good / Easy**. The app decides when to show it again. |
| **Hard cards** | All the cards you found hard or flagged ⚑, so you can drill them. |
| **Browse** | Search, edit, add, or delete any card. |
| **Import** | Add new cards (see below). |

**Keyboard shortcuts while studying:** `Space` = show answer, `1`=Again, `2`=Hard, `3`=Good, `4`=Easy.

---

## ✍️ 4. Make new cards (free, using claude.ai)

1. Go to the **Import** page in the app and click **Copy** on the prompt.
2. Open **claude.ai** in your browser and paste the prompt.
3. Attach your study material to the same message (a PDF or slides), or paste
   its text after the prompt. Send it.
4. Claude replies with a blue **code block**. Copy all of it.
5. Back in the app: **Import → claude.ai cards** tab → paste it → **Preview** → choose a deck → **Import**.

That's it — your new cards are ready to study. ✅

---

## 📦 5. Get free USMLE / OB-GYN decks (AnKing, Zanki…)

1. Go to **ankiweb.net/shared** and search e.g. **AnKing**, **Zanki**, or **Lightyear**.
2. Download the deck — you'll get a file ending in **`.apkg`**.
3. In the app: **Import → Anki deck (.apkg)** tab → choose the file → **Import deck**.

There's a small example file to test with: `studycards/samples/sample-anki-deck.apkg`.

> Notes: images aren't imported (text only) in this version. If a deck won't load, re-export it from the Anki app with the "Support older Anki versions" box ticked.

---

## 📱 6. Want it on your iPad?

See the separate guide: **`DEPLOY-TO-IPAD.md`** — it walks you through putting the app online for free, step by step.

---

## ⚠️ Important
- These cards (yours and community ones) can contain mistakes. **Always verify facts** against ACOG/RCOG guidelines, UpToDate, and your seniors. This app is a study aid, not a clinical reference.
- Don't put real patient details into the app or into claude.ai.
