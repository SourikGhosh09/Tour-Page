# Ghure Ashi Tour & Travels

A deploy-ready full-stack travel website with a cinematic React/GSAP storefront, transactional bookings, PostgreSQL inventory, and a protected master-admin control room.

## Included

- Scroll-driven cinematic homepage with reduced-motion and mobile alternatives
- Live package catalogue and departure availability from PostgreSQL
- Multi-step traveller booking with server-authoritative pricing
- Transactional seat reservation that prevents overselling
- Master/staff admin accounts with permission-based access controls
- Database-backed business profile controls for the logo and contact information
- Guest review submissions with moderated photo and video uploads
- Admin review editing, publishing, verification, and audited deletion
- Validation, rate limiting, secure cookies, and browser security headers
- Vercel, Docker, and Render deployment configuration

## Local setup

### One-click Windows start

After completing the initial `.env` setup, double-click `START_GHURE_ASHI.bat` in the project folder. It checks PostgreSQL and dependencies, applies migrations, starts the frontend and backend, and opens the website automatically. Running it again starts only any missing part of the app.

Manual setup:

1. Install Node.js 22+ and PostgreSQL 16+.
2. Create a database named `ghure_ashi`.
3. Copy `.env.example` to `.env` and replace every placeholder.
4. Run:

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

The storefront runs at `http://localhost:5173`; admin is at `http://localhost:5173/admin`.

## Deploy to Vercel

The repository includes `vercel.json` and a Vercel Function adapter for the Express API. Local uploads continue to use `uploads/`; production uploads use Vercel Blob.

1. Push the latest project files to GitHub.
2. In Vercel, select **Add New → Project**, import `SourikGhosh09/Tour-Page`, and deploy it as a Vite project.
3. In the Vercel project, open **Storage**, create and connect a Neon Postgres database, and confirm that it provides `DATABASE_URL`.
4. In **Storage**, create and connect a **public** Blob store. Vercel automatically provides `BLOB_READ_WRITE_TOKEN`.
5. In **Settings → Environment Variables**, add these values for Production and Preview:

```text
NODE_ENV=production
DATABASE_SSL=true
JWT_SECRET=a-random-secret-containing-at-least-32-characters
ADMIN_EMAIL=your-real-admin-email
ADMIN_PASSWORD=a-strong-new-admin-password
```

`APP_ORIGIN` is not required on Vercel because the frontend and API share one domain.

6. Pull the production environment into a temporary ignored file, then initialize the hosted database once:

```bash
npx vercel link
npx vercel env pull .env.vercel.local --environment=production
node --env-file=.env.vercel.local server/migrate.js
node --env-file=.env.vercel.local server/seed.js
```

7. Redeploy from the Vercel dashboard and verify `/api/health`, `/admin`, booking submission, and a review-media upload.

Do not commit `.env` or `.env.vercel.local`. After the first seed, remove `ADMIN_PASSWORD` from Vercel unless you intentionally want future seed runs to reset the master password.

## Render alternative

`render.yaml` can provision the web service and PostgreSQL database on Render. It uses a persistent disk for guest uploads. Vercel uses Blob instead because function filesystems are not persistent.

## Payment boundary

Bookings currently reserve inventory as `pending` and return a provider-required payment state. Live payment requires the merchant's chosen provider and credentials. Add provider order creation and a signed webhook that changes a booking to `confirmed`; never confirm payment from a client redirect alone.

## Operational notes

- Use managed PostgreSQL backups and HTTPS.
- Set a random `JWT_SECRET` of at least 32 characters.
- Review submissions remain pending until an authorized admin publishes them by default. In **Gallery & reviews → Review approval**, enable **Automatically approve new reviews** to publish every new submission immediately. The saved, audited toggle can be switched off at any time; existing pending reviews still require approval. Automatic approval does not mark a traveller as verified.
- Review media accepts JPG, PNG, WebP, MP4, and WebM, with five files per review and a 25 MB per-file limit.
- Pending bookings should be expired by a scheduled job before launch so abandoned reservations release seats.
