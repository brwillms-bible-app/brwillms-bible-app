# Put Your Illustrated Bible App on the Internet: Step-by-Step Guide

**What you'll end up with:** a free public website (for example `illustrated-bible-app.vercel.app`) that anyone can open.
**Time needed:** about 20–30 minutes. **Cost:** $0. **No coding, Git, or terminal needed.**

**Why this route:** uploading through the GitHub website and deploying with Vercel uses only drag-and-drop and buttons in your web browser. It's the simplest path that still gives you automatic updates later.

The plan in one line: **zip → unzip → GitHub (stores the code) → Vercel (turns the code into a live website).**

---

## Stage 1: Get the code onto your computer

1. Download **`illustrated-bible-app.zip`** from the chat message I send you. Save it somewhere easy, such as your **Desktop** or **Downloads** folder.
2. **Unzip it.** On a Mac, double-click the zip. On Windows, right-click it → **Extract All…** → **Extract**.
3. Open the new **`illustrated-bible-app`** folder. You should see files such as **`package.json`**, **`README.md`**, and **`next.config.mjs`**, plus folders named **`src`**, **`public`**, **`scripts`**, **`tests`**, and **`screenshots`**.

> **If you see** a folder inside a folder (for example `illustrated-bible-app/illustrated-bible-app/…`), **do this:** keep opening folders until you see **`package.json`** directly in front of you. That's the folder whose *contents* you'll upload in Stage 3.

**Good to know:** the project has **62 files** (about 2.8 MB) in total, and the largest is under 1 MB. That's well within GitHub's website limits of **100 files per upload** and **25 MB per file**, so **you can upload everything in one go**. No batches needed.

---

## Stage 2: Create a free GitHub account

GitHub is where your code is stored online.

1. Go to **https://github.com/signup**.
2. Enter your email, create a password, and choose a **username**. Then follow the prompts, which include a puzzle and an email code.
3. If GitHub asks you to pick a plan, choose **Free**.

> **If you see** "username is not available," **do this:** try a variation (add numbers or your initials). Your username will appear in your repository's web address, but not in your app's address.

---

## Stage 3: Create a repository and upload the files

A **repository** (or "repo") is a project folder on GitHub.

1. While signed in to GitHub, click the **+** at the top right → **New repository**.
2. **Repository name:** `illustrated-bible-app`.
3. Choose **Public** or **Private**. Both work with Vercel. **Private** keeps the code hidden, while the website itself stays public.
4. **Leave everything else unticked.** Don't add a README, .gitignore, or license, because the project already has these.
5. Click **Create repository**.
6. On the next page, find the line **"…or create a new file or uploading an existing file"** and click **uploading an existing file**.
7. Open your unzipped **`illustrated-bible-app`** folder on your computer (the one where you can see `package.json`).
8. **Select everything inside it.** Mac: **Cmd + A**. Windows: **Ctrl + A**. Then **drag the selection** into the GitHub upload box in your browser.
   - Drag the **contents** of the folder, **not the folder itself**. Otherwise everything lands one level too deep (see the troubleshooting note below).
   - In **Chrome** or **Edge**, dragging folders (such as `src` and `public`) keeps their inner folder structure. Use one of those browsers if you can.
9. Wait until the file list stops growing. It should show about **60–62 files**, with names like `src/app/page.tsx`.
10. Scroll down. In the **commit message** box, type something like `First upload`, and leave **"Commit directly to the main branch"** selected.
11. Click **Commit changes**. When it finishes, your repo page should show `package.json`, `src`, `public`, and so on **at the top level**.

**About hidden files (Mac):** two files start with a dot: **`.gitignore`** and **`.env.example`**. macOS **Finder hides dot-files**, so **Cmd + A** may not select them. To show them, press **Cmd + Shift + .** (Command, Shift, and the period key) in the Finder window; press it again to hide them. **It doesn't matter if they get skipped.** The website builds and runs fine without them. `.gitignore` only matters for people who use Git on their own computer, and `.env.example` is just a sample settings note. (On Windows, both files show up normally.)

> **If you see** your repo page show a single folder named `illustrated-bible-app` instead of `package.json` at the top, **do this:** the files were uploaded one level too deep. **Easiest fix:** leave it as is and set **Root Directory** to `illustrated-bible-app` in Vercel (Stage 5, step 5). **Alternatively,** delete the repo (**Settings** → scroll to the bottom → **Delete this repository**) and redo Stage 3, dragging the folder's **contents**.
>
> **If you see** "Yowza, that's a lot of files" or an upload limit warning, **do this:** you probably dragged a `node_modules` folder from somewhere else. The zip I sent doesn't contain one. Re-unzip a fresh copy and drag from that.

---

## Stage 4: Create a free Vercel account

Vercel turns the code on GitHub into a live website.

1. Go to **https://vercel.com/signup**.
2. When asked about your plan, choose **Hobby** (free, for personal projects). Enter your name.
3. Click **Continue with GitHub**, then click **Authorize Vercel** on the GitHub page that appears.
4. You'll land on your Vercel **Dashboard**.

**About the Hobby plan:** Vercel's free **Hobby** plan is for **personal, non-commercial use**. That fits this app, because Crossway's ESV terms also require it to stay **non-commercial**: no ads, paywalls, subscriptions, or donation requests.

> **If you see** a prompt to start a **Pro trial** or enter a card, **do this:** go back and choose **Hobby**. No payment details are needed.

---

## Stage 5: Import your repository into Vercel

1. On the Vercel Dashboard, click **Add New…** → **Project**.
2. Under **Import Git Repository**, find **`illustrated-bible-app`** and click **Import**.
   - If Vercel asks to **install the Vercel app on GitHub**, click **Install**. You can choose **All repositories** or **Only select repositories** (then pick `illustrated-bible-app`).
3. On the **Configure Project** (New Project) screen, check that **Framework Preset** says **Next.js**. Vercel detects this automatically.
4. **Leave all the other settings at their defaults.** Don't change the Build Command or Output Directory, and **don't add any Environment Variables**. None are needed right now.
5. **Root Directory** should be `./`. *Only* if your GitHub repo shows the files inside an extra `illustrated-bible-app` folder (see the Stage 3 note), click **Edit** next to Root Directory and select that folder.

> **If you see** your repo missing from the import list, **do this:** click **Adjust GitHub App Permissions** (or "Configure GitHub App") and give Vercel access to `illustrated-bible-app`, then come back and refresh the page.

---

## Stage 6: Deploy and get your live web address

1. Click **Deploy**.
2. Wait about **1–3 minutes** while Vercel installs and builds everything. You'll see a scrolling build log, which is normal.
3. When you see the **Congratulations** screen with a preview of your site, click the preview or **Continue to Dashboard**.
4. Your live address appears under **Domains**, ending in **`.vercel.app`**, for example **`https://illustrated-bible-app.vercel.app`** (Vercel may add extra letters if the name is taken). **Bookmark and share this link.**

> **If you see** **"Build Failed"** or a red error, **do this:**
> 1. Look at the **Build Logs**. Errors like *"Couldn't find any `pages` or `app` directory"* or *"No package.json found"* almost always mean the **Root Directory** is wrong. Go to **Project → Settings → Build and Deployment → Root Directory**, set it to the folder that contains `package.json`, click **Save**, then redeploy (see Stage 8, step 5).
> 2. If a file is missing (for example `src/...`), check that the GitHub repo has **`src`**, **`public`**, and **`scripts`** folders with files in them. If not, upload them again (Stage 3).
> 3. Still stuck? Copy the last ~20 lines of the build log and send them to me.

---

## Stage 7: What you should see on the live site

1. **Home page:** a dark header saying **"📜 Picture Bible Adventures"**, a big headline ("Explore the Bible, one picture at a time ✨"), and a **featured card** with the painting of Abram leading his family, labelled **"⭐ Start here · Genesis 12:1-9"** with a **"▶ Open the scene"** button. Below it are scene cards for **Genesis**, **John**, and **Luke** (simple cartoon placeholder art), each next to a colourful **book intro card** (who wrote it, when, the big idea, and what we learn).
2. Click the featured card. The **"Abram's Big Journey"** scene opens with the painting and an orange **"▶ Start the story"** button over it.
3. **Tap the painting.** Within a second:
   - **Right side:** the verses of **Genesis 12:1-9** appear with small verse numbers, a purple **"STUB · Berean Standard Bible (stub)"** tag, and a **"🔊 Audio coming soon"** badge.
   - **Below:** a **map** titled **"Abram's Journey: Haran to Canaan"** with a dashed orange line from **Haran** (green pin, in today's Turkey) down to **Shechem (Canaan)** (orange pin). You can zoom with the + / – buttons.
   - **Next to the map:** a yellow **💡 Learning Objective** box: *"God calls Abram to trust and obey, with a promise of blessing for all nations."*
4. **Bottom of every page:** a line about the Scripture source (Berean Standard Bible, public domain), "Free forever: no ads…", and a **Copyright details** link.

> **If you see** a blank or grey map box, **do this:** wait a few seconds and refresh. The map tiles come from a free map service (OpenFreeMap). If it stays blank, try another browser. Everything else on the page still works.

---

## Stage 8: Adding the ESV later (not needed now)

The site works today **without any keys**, using the public-domain Berean Standard Bible sample. When you want the **ESV** text and official ESV audio instead:

1. Get a free **ESV API key**: go to **https://api.esv.org**, create an account, and create an **API Application**. It's free for non-commercial use, and Crossway gives you a key (a long string of letters and numbers). **Keep it private.** Never paste it into GitHub.
2. In Vercel, open your project → **Settings** → **Environment Variables**.
3. Add the first variable: **Key** `ESV_API_KEY`, **Value** your key. Leave **Production** and **Preview** ticked (Development is optional), then click **Save**.
4. Add a second variable: **Key** `SCRIPTURE_PROVIDER`, **Value** `esv`, then click **Save**.
5. **Redeploy**, because new settings only apply to new deployments: go to the **Deployments** tab, click the **⋯** menu next to the newest deployment → **Redeploy** → confirm **Redeploy**.
6. After a couple of minutes, open your site. Scenes now load the **ESV text and audio live** from Crossway, and the required ESV copyright notice (with a link to esv.org) appears on every page automatically.

To switch back, change `SCRIPTURE_PROVIDER` to `bsb` (or delete it) and redeploy.

> **If you see** **"API key not configured"** after switching to ESV, **do this:** check that the variable name is exactly `ESV_API_KEY` (all capitals, underscores, no spaces), that you **redeployed** after saving, and that **Production** was ticked.
>
> **If you see** **"The ESV API rejected the server's credentials,"** **do this:** the key was mistyped or revoked. Copy it again from api.esv.org, edit the variable (⋯ → **Edit**), then redeploy.

---

## Updating the site later

Any time you change files on GitHub (for example **Add file → Upload files** to replace artwork), Vercel **automatically rebuilds and republishes** the site within a few minutes. There's nothing to click in Vercel.
