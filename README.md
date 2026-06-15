# MOAR Co-working Space — Lovable + Firebase MVP

This is a complete React + Vite project for a co-working space system with two operating panels:

- Member/User App: mobile-style user panel
- Host/Admin Portal: desktop admin dashboard

The project supports Firebase Authentication, Cloud Firestore, Firebase Storage, Firebase Hosting, and a local demo mode.

## Main business logic

Host/Admin controls almost everything:

- Add/edit member
- Assign desk
- Set membership type and renewal date
- Create bills
- Mark bills paid/unpaid
- Create meeting bookings
- Publish notices, events, news/vlog
- Monitor usage and billing
- Manage desk status

Member/User can only:

- Check in and check out
- Change usage month filter
- Upload/change profile picture
- View profile, membership, orders, usage, bills, bookings, and content

## Project routes/roles

This is one combined app. After login, the app opens the correct panel based on the user's role in `profiles/{uid}`:

- `role: admin` or `host` opens Host/Admin Portal
- `role: member` opens Member App

## Quick demo without Firebase

```bash
npm install
npm run dev
```

Then click:

- `Open Demo Host/Admin Panel`
- or `Open Demo Member App`

Demo mode stores data in browser localStorage only.

## Firebase setup summary

1. Create a Firebase project.
2. Enable Authentication > Email/Password.
3. Create a Web App and copy Firebase config.
4. Create `.env` from `.env.example`.
5. Enable Firestore Database.
6. Enable Storage.
7. Edit `firestore.rules` and `storage.rules` admin emails.
8. Deploy rules.
9. Create admin account from app or Firebase Console.
10. Seed demo data from Admin > Settings.

Full steps are in `docs/FIREBASE_SETUP.md`.

## Useful commands

```bash
npm install
npm run dev
npm run build
firebase login
firebase init
firebase deploy --only firestore:rules,storage
firebase deploy --only hosting
```

## Important security note

Firebase web config is okay to use in frontend code, but access must be protected by Firestore and Storage rules. Do not upload service account private key files to this project.
