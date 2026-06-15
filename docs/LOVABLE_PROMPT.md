Build a clean modern co-working space management web app named MOAR.

Use React + Vite style. Create one combined app with role-based views:

1. Host/Admin Portal desktop dashboard
2. Member/User mobile-style app

Use Firebase as backend:

- Firebase Authentication for email/password login
- Cloud Firestore for members, desks, bills, bookings, content, attendance logs, branches, profiles
- Firebase Storage for profile photos and contracts

Admin/Host controls:

- Add/edit members
- Assign dedicated desk
- Update membership type, branch, status, renewal date
- Create bills and mark paid/unpaid
- Create meeting room bookings
- Publish notices, events, news/vlog
- Manage desk status
- Monitor usage and billing

Member/User can only:

- Check in and check out
- Change usage month filter
- Upload/change profile picture
- View membership, profile, assigned desk, orders, bills, bookings, usage analytics, notices/news/events

Design style:

- White and light gray dashboard background
- Green primary color #16a34a / #4CAF7D
- Rounded cards, soft shadows, clean tables
- Desktop admin sidebar with topbar
- Mobile app frame for member panel with bottom navigation
- Usage Analytics card on member home showing Total Days, Avg Hours, This Week, with month selector

Data flow:

Host/Admin updates Firestore. Member app listens to Firestore and updates automatically. Member profile fields are view-only except profile photo.
