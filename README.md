# ARTS website

The website for ARTS, the Accident Report and Tracking System. Drivers sign in to report incidents, use the SOS button, track their reports and manage their emergency medical information. Administrators sign in to a live dashboard to review incidents, forward them to emergency services, manage services and users, and read analytics.

It shares one Firebase project (`arts-477f0`) with the ARTS Android app, so a report made on the phone appears on the dashboard within a second, and the other way round.

Plain HTML, CSS and JavaScript. No build step.

## Run it locally

Open the folder in VS Code and use Live Server on `index.html` (open `localhost:5500`, not `127.0.0.1`). Sign-in needs a web address, so double-clicking the file will not work.

## First-time setup for a new Firebase project

1. Replace `firebaseConfig` in `js/firebase.js` with your project's web config.
2. Publish `firestore.rules` (Firebase console, Firestore, Rules).
3. Register an account on the site, copy its UID from Authentication, and in Firestore create the collection `admins` with a document whose id is that UID (any field, for example `email`).
4. Sign in on the Administrator tab and press **Load demo data**.

## Deploy

```
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules,hosting
```

The site is then live at `https://arts-477f0.web.app`.

## Folders

```
index.html          sign-in and registration (email, Google)
user.html           driver portal
dashboard.html      administrator dashboard
js/                 firebase.js, storage.js (data and sign-in layer), page controllers
css/styles.css      all styling
firestore.rules     database security rules
firebase.json       hosting and rules configuration
DATABASE.md         collections, fields and relationships
```
