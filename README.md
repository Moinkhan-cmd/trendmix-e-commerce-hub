# TrendMix E-Commerce Hub

A modern e-commerce platform for beauty products, jewelry, and fashion accessories.

## Technologies Used

- **Vite** - Fast build tool and dev server
- **TypeScript** - Type-safe JavaScript
- **React** - UI library
- **shadcn-ui** - UI components
- **Tailwind CSS** - Utility-first CSS framework
- **Firebase** - Authentication & Firestore database

## Getting Started

### Prerequisites

- Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

### Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project directory
cd trendmix-e-commerce-hub

# Install dependencies
npm install

# Start the development server
npm run dev
```

---

# Admin Panel (React + Firebase Firestore) — Setup Guide

This project includes an admin-only dashboard (no Firebase Storage, no billing upgrade).

## 1) Create a Firebase project (Spark/free)

1. Go to Firebase Console → **Add project**.
2. Keep the plan on **Spark** (free).
3. Create a **Web App** inside the project.
4. Copy the Web App config values (apiKey, authDomain, projectId, appId, etc.).

## 2) Enable Authentication (Email/Password)

Firebase Console → **Build → Authentication → Sign-in method**
- Enable **Email/Password**.

## 3) Create Firestore (in Production mode)

Firebase Console → **Build → Firestore Database**
- Create database (choose your region)
- Choose **Production mode** (recommended)

This app only uses:
- Firebase Auth
- Firestore

It does **not** use:
- Firebase Storage
- Paid/billing features

## 4) Add environment variables (no secrets in code)

1. Copy `.env.example` to `.env.local`
2. Fill in the values from your Firebase Web App config.

Example `.env.local`:

```env
VITE_FIREBASE_API_KEY="..."
VITE_FIREBASE_AUTH_DOMAIN="..."
VITE_FIREBASE_PROJECT_ID="..."
VITE_FIREBASE_APP_ID="..."
# optional
VITE_FIREBASE_STORAGE_BUCKET="..."
VITE_FIREBASE_MESSAGING_SENDER_ID="..."
```

Then restart the dev server.

## 4.1) Security Environment Variables (Required)

Frontend (`.env.local`):

```env
VITE_FIREBASE_API_KEY="..."
VITE_FIREBASE_AUTH_DOMAIN="..."
VITE_FIREBASE_PROJECT_ID="..."
VITE_FIREBASE_APP_ID="..."
VITE_FIREBASE_STORAGE_BUCKET="..."
VITE_FIREBASE_MESSAGING_SENDER_ID="..."
VITE_RECAPTCHA_SITE_KEY="YOUR_RECAPTCHA_V3_SITE_KEY"
VITE_FIREBASE_FUNCTIONS_URL="https://us-central1-<project-id>.cloudfunctions.net"
```

Functions (`functions/.env`):

```env
RAZORPAY_KEY_ID="YOUR_RAZORPAY_KEY_ID"
RAZORPAY_KEY_SECRET="YOUR_RAZORPAY_KEY_SECRET"
RECAPTCHA_SECRET_KEY="YOUR_RECAPTCHA_V3_SECRET"
RECAPTCHA_MIN_SCORE="0.5"
ALLOWED_ORIGINS="https://yourdomain.com,https://www.yourdomain.com"
SHIPROCKET_EMAIL="your-shiprocket-login-email@example.com"
SHIPROCKET_PASSWORD="your-shiprocket-password"
SHIPROCKET_PICKUP_LOCATION="Primary"
SHIPROCKET_DEFAULT_WEIGHT_KG="0.5"
SHIPROCKET_DEFAULT_LENGTH_CM="20"
SHIPROCKET_DEFAULT_BREADTH_CM="20"
SHIPROCKET_DEFAULT_HEIGHT_CM="10"
```

Security notes:
- Never commit `.env`, `.env.local`, or `functions/.env`.
- Rotate Razorpay keys and reCAPTCHA secret immediately if previously exposed.
- Firebase Web config is public by design; keep only non-secret identifiers there.
- Shiprocket credentials are server-only. Do not place them in frontend env files.

### 4.2) Shiprocket Integration Setup (Backend Only)

1. Open [functions/.env.example](functions/.env.example) and copy it to `functions/.env`.
2. Open [functions/.env](functions/.env) and set:
  - `SHIPROCKET_EMAIL`
  - `SHIPROCKET_PASSWORD`
3. (Optional) adjust package defaults in `functions/.env`:
  - `SHIPROCKET_PICKUP_LOCATION`
  - `SHIPROCKET_DEFAULT_WEIGHT_KG`, `SHIPROCKET_DEFAULT_LENGTH_CM`, `SHIPROCKET_DEFAULT_BREADTH_CM`, `SHIPROCKET_DEFAULT_HEIGHT_CM`
4. Run commands:
  - `cd functions`
  - `npm run build`
  - `cd ..`
  - `firebase deploy --only functions`

Integration behavior:
- Shipment is created from backend only after order creation.
- Prepaid shipments are created only after successful Razorpay verification creates the order.
- COD shipments use existing COD decision from order data and pass `payment_method = COD` to Shiprocket.
- On Shiprocket API failure, order document stores `shipment_status = creation_failed`.

## 5) Create your first admin user (IMPORTANT)

Admin access is controlled by Firestore:
- A user is an admin **only if** a document exists at: `admins/{uid}`

### Step A — Create the user account in Auth
Firebase Console → **Authentication → Users → Add user**
- Email + password

### Step B — Mark them as admin in Firestore
Firebase Console → **Firestore Database → Data**
Create:
- Collection: `admins`
- Document ID: `<THE_USER_UID_FROM_AUTH>`
- Fields (optional):
  - `email` (string)
  - `createdAt` (timestamp)

That is it.

If a non-admin logs in, the app will immediately sign them out.

## 6) Firestore Data Model (collections)

This admin panel expects these top-level collections:

### `products`
Each product document should look like:

```js
{
  name: string,
  price: number,
  categoryId: string,     // references categories doc id
  categorySlug: string,   // e.g. "cosmetics"
  description: string,
  stock: number,
  imageUrls: string[],    // URL-based images ONLY
  published: boolean,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### `categories`

```js
{
  name: string,
  slug: string,           // e.g. "cosmetics"
  imageUrl: string,       // URL-based images ONLY
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### `orders`

```js
{
  userId: string,
  items: Array<{
    productId: string,
    name: string,
    qty: number,
    price: number,
    imageUrl: string
  }>,
  status: "Pending" | "Shipped" | "Delivered" | "Cancelled",
  total: number,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### `users`

```js
{
  email: string,
  displayName?: string,
  blocked: boolean,
  createdAt: timestamp
}
```

## 7) Firestore Security Rules (admin-only)

Use these rules in Firebase Console → **Firestore Database → Rules**.

These rules:
- Allow anyone to read **published products and categories** (public storefront)
- Allow only admins to create/update/delete anything
- Allow admins to manage orders and users

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return isSignedIn() && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }

    // Admin registry
    match /admins/{uid} {
      allow read: if isAdmin();
      allow write: if false; // Create admin docs only via Firebase Console (manual)
    }

    // Products
    match /products/{id} {
      allow read: if resource.data.published == true || isAdmin();
      allow create, update, delete: if isAdmin();
    }

    // Categories
    match /categories/{id} {
      allow read: if true;
      allow create, update, delete: if isAdmin();
    }

    // Orders
    match /orders/{id} {
      allow read, write: if isAdmin();
    }

    // Users
    match /users/{id} {
      allow read, write: if isAdmin();
    }

    // Default deny
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## 8) Run the app

```sh
npm install
npm run dev
```

Admin routes:
- `/admin/login` for admin login
- `/admin` for the dashboard

## Production Security Upgrade Summary

Implemented hardening includes:
- Google reCAPTCHA v3 on signup, login, and checkout initiation.
- Backend reCAPTCHA verification with score enforcement (`>= 0.5`) and action validation.
- Email-verified enforcement for checkout/payment/order placement.
- Razorpay signature verification on backend before order marked paid.
- Server-side canonical order calculation from Firestore product data (amount tamper protection).
- Owner-only order data access with admin override.
- Admin-only product/category/settings writes.
- Secret handling moved fully to environment files.
- Login brute-force mitigation (Firebase + client lockout + backend request throttling).
- Input sanitization for auth profile updates and checkout/order payloads.

## Updated Security-Critical Folder Structure

```text
src/
  lib/
    recaptcha.ts                # reCAPTCHA token generation + backend assessment call
    razorpay.ts                 # secure create/verify payment flow with backend
    orders.ts                   # owner-scoped order reads/writes
    firebase.ts                 # env-only Firebase config (no hardcoded fallback)
  pages/
    Login.tsx                   # reCAPTCHA + verification-aware login UX
    SignUp.tsx                  # reCAPTCHA-protected registration
    Checkout.tsx                # verified-user gate + secure Razorpay flow
    OrderTracking.tsx           # authenticated tracking access
  auth/
    auth-service.ts             # brute-force mitigation + sanitization

functions/
  src/
    index.ts                    # verifyRecaptchaAssessment, createRazorpayOrder, verifyRazorpayPayment
  .env.example                  # secure backend env template

firestore.rules                 # production-safe least-privilege rules
```

## Step-by-Step Secure Deployment

1. Create reCAPTCHA v3 keys (Google reCAPTCHA admin console).
2. Set frontend and functions env vars from the templates.
3. Deploy functions:
   - `cd functions`
   - `npm install`
   - `npm run build`
   - `firebase deploy --only functions`
4. Deploy Firestore rules:
   - `firebase deploy --only firestore:rules`
5. Redeploy frontend after setting `VITE_FIREBASE_FUNCTIONS_URL` and `VITE_RECAPTCHA_SITE_KEY`.
6. Test security flows:
   - Signup requires reCAPTCHA.
   - Login requires reCAPTCHA and blocks repeated failures.
   - Unverified users are blocked from checkout/order placement.
   - Razorpay success is accepted only after backend signature verification.

## Security Best Practices

- Keep all secrets in backend environment variables only.
- Restrict CORS with explicit production domains in `ALLOWED_ORIGINS`.
- Prefer backend-generated totals from trusted product prices.
- Treat all client payloads as untrusted; validate/sanitize server-side.
- Use Firebase custom claims or strict admin registry for privileged operations.
- Monitor `security_rate_limits` and payment logs for abuse patterns.

## Troubleshooting

- If you see "Missing Firebase env vars…": your `.env.local` is missing required keys.
- If login works but you get logged out instantly: you are not in `admins/{uid}`.
