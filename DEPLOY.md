# Deploying for students (Railway – about 15 minutes)

The repo contains a `Dockerfile` that packages the API **and** the web app into one container, so students just open one URL (works on phones and desktop browsers; they can "Add to Home screen"). The container needs a MySQL database. Railway offers both in one place.
(Prices change – check railway.com/pricing. Other hosts that run Docker + MySQL work too: Render + Aiven MySQL, Azure App Service + Azure Database for MySQL, Fly.io.)

## Steps
1. Create an account at **railway.com** and sign in with GitHub.
2. **New Project → Deploy from GitHub repo** → pick `samadhan84/Police_Bharti_mh` → choose the branch you want live (merge the work branch into `main` first, or pick `claude/police-bharti-mock-exam-bcue32`). Railway detects the `Dockerfile`.
3. In the same project: **+ New → Database → Add MySQL**.
4. Open your app service → **Variables** and add:
   | Variable | Value |
   |---|---|
   | `MYSQLHOST` | `${{MySQL.MYSQLHOST}}` |
   | `MYSQLPORT` | `${{MySQL.MYSQLPORT}}` |
   | `MYSQLUSER` | `${{MySQL.MYSQLUSER}}` |
   | `MYSQLPASSWORD` | `${{MySQL.MYSQLPASSWORD}}` |
   | `MYSQLDATABASE` | `${{MySQL.MYSQLDATABASE}}` |
   | `Jwt__Key` | a long random secret (32+ chars) – e.g. output of `openssl rand -base64 48` |
   | `Admin__Emails__0` | **your** email, the one you will register as admin |
   (`PORT` is set by Railway automatically.)
5. **Settings → Networking → Generate Domain** → you get `https://<name>.up.railway.app`.
6. Open the URL → **register with the admin email from step 4 immediately** (before sharing the link – whoever registers that email first becomes admin) → open the **प्रशासन** tab and import your questions.
7. Share the URL with students.

On first start the app creates the tables and loads the ~114 sample questions. Redeploys happen automatically on every push to the chosen branch.

## Before real students use it
- **Questions:** add many more via the admin import (target 1000+); the built-in set is only a sample, and Marathi translations should be proof-read.
- **Backups:** enable Railway's MySQL backups (or export with `mysqldump`) – student results live only in this database.
- **Custom domain:** Settings → Networking → Custom Domain (HTTPS is automatic).
- **Capacity:** the default plan is fine for tens of concurrent students; for a big batch exam day, scale the service up beforehand.
- **Privacy:** the app stores names, emails and exam results – tell students, and don't log or share them.
- **Android app:** build it with `VITE_API_URL=https://<your-domain>/api` (see README) to point it at the live server.

## Run the container yourself (any server with Docker)
```bash
docker build -t pb-app .
docker run -d -p 80:8080 --restart unless-stopped \
  -e PORT=8080 -e Jwt__Key="$(openssl rand -base64 48)" -e Admin__Emails__0=you@example.com \
  -e "ConnectionStrings__Default=Server=<db-host>;Port=3306;Database=police_bharti;User=<user>;Password=<pw>;" \
  pb-app
```
Put it behind HTTPS (Caddy, nginx, Cloudflare) – never expose logins over plain HTTP.
