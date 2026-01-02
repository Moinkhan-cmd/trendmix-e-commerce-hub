# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/ed642a22-e215-4065-a0d4-568e7f92761a

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/ed642a22-e215-4065-a0d4-568e7f92761a) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/ed642a22-e215-4065-a0d4-568e7f92761a) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

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

That’s it.

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
npm i
npm run dev
```

Once the admin UI routes are added, you will use:
- `/admin/login` for admin login
- `/admin` for the dashboard

## Troubleshooting

- If you see “Missing Firebase env vars…”: your `.env.local` is missing required keys.
- If login works but you get logged out instantly: you are not in `admins/{uid}`.

