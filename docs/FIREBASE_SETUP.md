# Firebase setup guide for MOAR Co-working Space

## 1. Create Firebase project

Go to Firebase Console and create a new project, for example:

`moar-coworking-space`

## 2. Enable Firebase Authentication

Open:

`Build > Authentication > Sign-in method`

Enable:

`Email/Password`

Create at least one admin account later, for example:

`admin@moar.com`

## 3. Create Firebase Web App

Open:

`Project settings > General > Your apps > Web app`

Register a web app and copy the config values.

## 4. Add .env file

Copy `.env.example` and rename it to `.env`.

Fill the values:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_ADMIN_EMAILS=admin@moar.com,host@moar.com
```

## 5. Update security rules admin emails

Open both files:

- `firestore.rules`
- `storage.rules`

Replace:

```js
'admin@moar.com',
'host@moar.com'
```

with your real admin/host emails.

## 6. Enable Firestore

Open:

`Build > Firestore Database`

Create database. Start in production mode. Select your preferred region.

## 7. Enable Storage

Open:

`Build > Storage`

Create default bucket.

## 8. Install and run locally

```bash
npm install
npm run dev
```

Open the local URL shown in terminal.

## 9. Login/create admin

Use the app login screen:

- Email: your admin email
- Password: minimum 6 characters
- Click `Create account`
- Then click `Set this account as Admin Host`

If admin creation fails, check that your email is correctly added inside `firestore.rules`.

## 10. Seed demo data

After admin profile is created, go to:

`Admin Portal > Settings > Seed Firebase Demo Data`

This adds demo branches, members, desks, bills, bookings, content, and attendance logs into Firestore.

## 11. Create member login

Create another Firebase Auth account using the same email as a member record, for example:

`arif@moar.demo`

After login, select:

`Set this account as Member`

The member app will read only the matching member profile and related bills/bookings/usage.

## 12. Deploy to Firebase Hosting

Install Firebase CLI if needed:

```bash
npm install -g firebase-tools
```

Login:

```bash
firebase login
```

Initialize hosting and rules:

```bash
firebase init
```

Select:

- Firestore
- Storage
- Hosting

Use:

- public directory: `dist`
- single page app rewrite: `Yes`
- overwrite files: `No`

Deploy:

```bash
npm run build
firebase deploy
```

## 13. Lovable usage

Lovable projects are standard Vite + React projects. You can use Lovable to refine UI and then connect/push to GitHub. Keep Firebase config in `.env`, not inside normal source files.

Use `docs/LOVABLE_PROMPT.md` if you want Lovable to recreate or improve this project design.
