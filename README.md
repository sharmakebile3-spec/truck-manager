# TruckManager

Fleet &amp; cross-border trip management console — trucks, trips, checkpoints, expenses, payments/invoices, and reports. Built with vanilla JS + Vite, backed by Firebase (Firestore + Auth).

## 1. Firebase project setup

1. Go to the [Firebase console](https://console.firebase.google.com/) → create a project (or use an existing one).
2. **Authentication** → Sign-in method → enable **Email/Password**.
   (The app signs users up with their real email + password, so Firebase's built-in "Forgot password" reset email works out of the box.)
3. **Firestore Database** → Create database → start in production mode.
4. Firestore → Rules tab → paste the contents of [`firestore.rules`](firestore.rules) from this repo → Publish.
   This restricts every user to only read/write their own data at `users/{uid}/...`.
5. Project settings (gear icon) → General → "Your apps" → Add app → Web (`</>`) → register the app → copy the `firebaseConfig` values.

## 2. Local setup

```bash
npm install
cp .env.example .env
```

Paste your Firebase config values into `.env`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Then run:

```bash
npm run dev
```

`.env` is git-ignored — never commit it.

## 3. Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel: New Project → import the GitHub repo. Framework preset: **Vite**.
3. Add the same six `VITE_FIREBASE_*` variables under Project Settings → Environment Variables.
4. Deploy.
5. Back in the Firebase console → Authentication → Settings → **Authorized domains** → add your `*.vercel.app` domain (and any custom domain), otherwise sign-in will be blocked from the deployed site.

## Data model (Firestore)

Every document lives under `users/{uid}/...` so each account's fleet data is private:

- `users/{uid}/trucks/{id}` — plate, model, trailers, driver info, status
- `users/{uid}/trips/{id}` — route, cargo, freight rate, embedded `checkpoints[]`
- `users/{uid}/expenses/{id}` — per-trip Dispatch / Fuel / Other costs
- `users/{uid}/payments/{id}` — per-trip invoice + payment entries
- `users/{uid}/meta/counters` — atomic counter for trip reference numbers (`TRP-2026-0001`, ...)
