# पोलीस भरती Mock Test (Maharashtra Police Bharti)

Mock-exam platform for the Maharashtra Police Bharti written test, for **web, Windows/Mac/Linux desktop and Android**.

| Layer | Tech |
|---|---|
| UI | React 18 + Vite (`frontend/`), Recharts for analytics |
| Desktop | Electron wrapper (`desktop/`) |
| Android | Capacitor wrapper of the same React build (`frontend/capacitor.config.json`) |
| API | C# .NET 8 minimal API, JWT auth, EF Core (`backend/PoliceBharti.Api/`) |
| DB | MySQL 8 (Pomelo EF provider) – tables are auto-created, questions auto-seeded |

## Features
- **Bilingual: Marathi (default) + English.** One-tap toggle on every screen, including mid-exam. Questions, options, explanations, subject/topic names, result pages, analytics and the "what to improve" advice all exist in both languages. Results/analytics have a **Print / Save as PDF** button for a Marathi (or English) report.
- Register / login (BCrypt-hashed passwords, JWT).
- **Full mock**: 100 Qs, 100 marks, 90 min, 25 each from Arithmetic, Reasoning, GK & Current Affairs, Marathi Grammar; no negative marking. Timer, question palette, mark-for-review, auto-submit, progress survives refresh.
- **Subject practice** (15 Qs).
- Result page: score, subject-wise chart, full answer review with explanations, time per question.
- **Analytics**: score trend, subject & topic accuracy, difficulty-wise accuracy, strong/weak topics, skipped-question and speed warnings, and a written "what to improve before the final exam" list.

## Admin panel (import questions)
Admins are the emails in config `Admin:Emails`. In Development this is `admin@policebharti.local` (see `appsettings.Development.json`); **register that email in the app, then log in** – an **Admin / प्रशासन** tab appears.
In production set `Admin__Emails__0=you@example.com` and register that account immediately, before anyone else can.

- **Import tab:** download the CSV template → fill in Excel (save as *CSV UTF-8*) → choose the file → **Validate (dry run)** → **Import**. JSON arrays with the same keys also work. Invalid rows are listed with the reason and skipped; duplicates (same subject + English text) are skipped; a new subject needs `subject_mr`.
- **All questions tab:** search/filter and delete (a question already used in a student's attempt cannot be deleted).
- CSV columns: `subject, subject_mr, topic_en, topic_mr, difficulty(1-3), question_en, question_mr, en_a..en_d, mr_a..mr_d, correct(A-D), explanation_en, explanation_mr`.

Check it: `backend/scripts/admin-smoke.sh` (API: permissions, dry-run, import, duplicates, invalid rows, delete).

## Exam pattern used
Written test (per Maharashtra Police recruitment sources): 100 questions × 1 mark, 90 minutes, four sections of 25 – Arithmetic, General Knowledge/Current Affairs, Reasoning, Marathi Grammar – objective, no negative marking. Physical test (running, shot-put, etc.) is separate and **not** covered by this app. Always confirm against the official notification on mahapolice.gov.in – marks/pattern can change per recruitment cycle.

> **Question bank note:** `backend/PoliceBharti.Api/SeedData/questions.json` has ~114 *original* practice questions written in the style/topics of the exam. They are **not** copies of past papers. Add real previous-year questions you are licensed to use in the same JSON format (see below) – a production app needs hundreds more (target 1000+).

## Deploy for students
See **[DEPLOY.md](DEPLOY.md)** – one Docker container (API + web app) + MySQL, step-by-step for Railway.

## Run it on GitHub (no installs)
**Codespaces:** on the repo page click **Code → Codespaces → Create codespace on `claude/police-bharti-mock-exam-bcue32`**. It builds a cloud dev machine with .NET, Node and MySQL, starts the API and web app automatically (first start takes a few minutes) and opens the app in a browser tab (port **5173**). If it doesn't open, use the **Ports** tab, or run `bash scripts/dev.sh` and check `/tmp/api.log`. Register `admin@policebharti.local` to get the admin panel.
**CI:** every push runs `.github/workflows/ci.yml` – builds the API and web app and runs both smoke tests against a real MySQL (see the **Actions** tab).
GitHub Pages cannot host this app (it needs the API + MySQL); for a public URL deploy the API to a host (Azure/Render/Railway + managed MySQL) and the built `frontend/dist` to any static host.

## Test mode: no MySQL, questions from a CSV
For quick testing the API can use a single **SQLite file** instead of MySQL and load its questions from a **CSV file** (same format as the admin import template; a ready file with all 114 sample questions is in `backend/sample-data/questions.csv` – edit it in Excel to test your own).
```bash
bash scripts/dev-nodb.sh                 # or: bash scripts/dev-nodb.sh my-questions.csv
```
or set environment variables yourself: `Database__Provider=sqlite`, optional `Database__SqlitePath=file.db`, optional `Seed__CsvPath=/path/questions.csv`.
The CSV is read **once, when the database file is first created** (delete the `.db` file to reload). Accounts and results are stored in the SQLite file, not in the CSV – a CSV can't safely handle many students writing at once. Don't use this mode for real students.

## Run locally
```bash
# 1. MySQL
mysql -u root -e "CREATE DATABASE police_bharti CHARACTER SET utf8mb4;
  CREATE USER 'pb_user'@'localhost' IDENTIFIED BY 'pb_pass'; GRANT ALL ON police_bharti.* TO 'pb_user'@'localhost';"

# 2. API  (http://localhost:5080)
cd backend/PoliceBharti.Api
ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS=http://localhost:5080 dotnet run
../scripts/smoke.sh          # optional end-to-end API check

# 3. Web UI (http://localhost:5173)
cd frontend && cp .env.example .env && npm install && npm run dev
```
Connection string: `ConnectionStrings__Default`. **Production:** set `Jwt__Key` to a long random secret (the app refuses to start otherwise) and serve over HTTPS.

## Desktop (Electron)
```bash
cd frontend && npm run build
cd ../desktop && npm install && npm start      # run
npm run dist                                   # installer (.exe / .dmg / AppImage)
```

## Android (Capacitor)
Requires Android Studio + JDK 17.
```bash
cd frontend
echo "VITE_API_URL=http://10.0.2.2:5080/api" > .env   # emulator; use your server's https URL for real devices
npm install
npx cap add android        # first time only
npm run android:sync
npm run android:open       # build/run APK from Android Studio
```

## Adding questions
Each question lives in two files under `SeedData/`, matched by position within the subject:
- `questions.json` row: `[topic, text, correctAnswer, wrong1, wrong2, wrong3, explanation, difficulty(1-3)]` (English for Arithmetic/Reasoning/GK, Marathi for Marathi Grammar).
- `translations.json` row: `[text, correctAnswer, wrong1, wrong2, wrong3, explanation]` in the *other* language.
- New topics need an `[english, marathi]` entry in `names.json`.

Put the correct answer first – the seeder shuffles options (same order in both languages). Seeding runs only on an empty `Questions` table. **Upgrading from the earlier English-only version:** the schema changed, so drop and recreate the `police_bharti` database once (no migrations yet).

## Roadmap (suggested)
Admin panel & bulk import, EF migrations, per-district previous-year paper sets, spaced-repetition of wrong answers, leaderboard, physical-test (PET) tracker, Play Store release.
