# Store Time Clock — Firebase migration

Firebase App Hosting serves this app at https://webbchapel--store-timeclock.us-east4.hosted.app. Import and verify existing records before switching employee punches to the Firebase version.

## Included

Firebase email/password login; multiple businesses/stores with separate managers and tablet accounts; employee PIN punches; decimal hours; manual shift edits with audit records; twice-monthly hourly/salary gross-pay estimates; per-store JSON backups and imports; installable web-app assets.

Pay periods are 1st–15th and 16th–month-end in America/Chicago. Salary rate means the amount PER PAY PERIOD. No taxes, overtime, benefits, or actual payroll payments are calculated. Review totals before paying employees.

Geolocking starts enabled. When enabled, clock-in and clock-out require a fresh, accurate GPS reading inside that store's configured boundary. The original Webb Chapel store retains its 300-foot boundary. Each store manager can toggle geolocking in Manager → Store name and location → Save store settings. Turning it off allows clock-in and clock-out without GPS; PINs and Firebase authorization remain required. Changes are audited. Employee GPS readings are not saved. Browser GPS can be spoofed and location accuracy must be tested on your tablet. A web app cannot enforce Android kiosk locking.

## 1. Preserve old data

In the old app's manager Backups panel, create and DOWNLOAD a JSON backup. Store a copy separately. Source-code ZIPs are NOT employee-data backups.

For the final cutover, pause punches on the old app and export a final backup. The two apps do not synchronize. Keep the old app until the imported hours and pay totals have been checked.

## 2. Prepare Firebase

Project: `store-timeclock`. Public web configuration is already included in `lib/firebase-client.ts`; it is not an administrator credential.

1. Authentication → Sign-in method → enable Email/Password.
2. Authentication → Users → create manager and SEPARATE store tablet accounts. Employees only need PINs, not Firebase or ChatGPT accounts.
3. Your supplied UID `CRWIoygqx9fYs2RJlQsBhLiCUT12` is configured in `apphosting.yaml` and `.env.example` as the OWNER. Confirm it matches your owner account in Authentication → Users. This account can create stores, assign managers, and access all stores. Other managers get access only to stores assigned to their exact UID. Do not share passwords or service-account keys.
4. Create Firestore in Native mode with database ID `(default)`.
5. Review Blaze pay-as-you-go billing before enabling App Hosting. Set billing alerts; these are NOT spending caps.

## 3. Deploy

Install Node.js 22.13+ and pnpm 11.25.0. In this folder:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm run build
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules --project store-timeclock
```

The rules deliberately deny ALL direct browser database access. The server checks Firebase ID tokens and roles. Do not replace them with an allow-all-signed-in-users rule.

GitHub is optional. For your existing `sumansubedi25/StoreTimeClock` repository, upload the updated project files at the repository root, including `.firebaserc`, `.gitignore`, and `.env.example`. Do not upload node_modules, .next, .env.local, or credentials. Keep one repository and one Firebase project for all stores; separate repositories and containers are unnecessary.

Firebase Console → App Hosting (not static Hosting) → create a backend → connect the repository → select your live branch and root folder → deploy. No manually managed container is needed. This is a dynamic Next.js app, not a static HTML export.

Alternatively, App Hosting supports a source ZIP upload from the console, or local CLI deployment with `npx firebase-tools init apphosting` followed by `npx firebase-tools deploy --only apphosting,firestore:rules --project store-timeclock`. During initialization keep the existing apphosting.yaml owner UID and select the project explicitly.

App Hosting supplies server Application Default Credentials. If runtime logs report permissions errors, check the backend runtime service account's IAM permissions for Firestore read/write and Firebase Authentication user/token access. Grant only the missing permissions to that service account, never the public or employees.

Add the deployed hostname to Authentication → Settings → Authorized domains.

Official guides:
- https://firebase.google.com/docs/app-hosting/get-started
- https://firebase.google.com/docs/app-hosting/about-app-hosting

## 4. Import, test, and switch

Sign into the NEW HTTPS URL using the owner Firebase account. Select Webb Chapel store (ID `main`). On the setup screen choose Import an existing backup and select the old JSON backup. Employees, hashed PINs, shifts, rates, audit records, and manager PIN are restored. Store assignments, tablet access, location and geolocking remain unchanged. Import into an initialized store requires its current manager PIN and replaces that store's business records only. Backups tagged with another store ID are rejected; untagged legacy backups can be imported deliberately.

Check employee counts, open/closed shifts, recent hours/pay totals, and audit history against the original app. If validation fails, keep the original data intact and investigate.

Manager controls → Store tablet access → enable the separate tablet email. On the tablet sign into THAT account, never your manager, Google, or ChatGPT account. Verify payroll, reports, backup and edit actions are denied.

Test wrong PINs, location clock-in, clock-out, manual manager edits, and backup download/restore with a test employee. Do not migrate employees until live tests pass.

Android Chrome on the new HTTPS URL → Install app/Add to Home screen if offered. Internet is required for punches. Strong kiosk security requires a managed Android dedicated-device solution using lock task mode and an owner-only exit password. Ordinary screen pinning is not equivalent. Enrollment may require a factory reset; back up the device first.

## 5. Add businesses/stores and their managers

1. In Firebase Authentication create a separate email/password manager account for each store and a separate tablet account. Do not reuse a manager account on a tablet.
2. Sign into the app as owner → Manage stores → Add a store. Enter its name, address, latitude/longitude, radius, geolocking choice, and the manager's Firebase email. These coordinates are entered manually; the app does not geocode street addresses or charge for a Maps API. Default radius is 300 feet. Valid radius range is 20–1000 meters.
3. That manager signs into the same app URL and sees their assigned store. They create a manager PIN, employees, pay rates, and enable their store tablet email.
4. That tablet account is restricted to its one assigned store's status and employee punches. Payroll, edits, settings, backups and store administration are denied server-side. Employee IDs and PINs can repeat between stores without sharing records.
5. The owner can change a manager assignment from Manage stores. The previous manager immediately loses server access unless still assigned to that store. Hand the new manager the store's existing PIN separately. Changing a manager never deletes employee history. The owner retains access to all stores.

Existing data stays under `main`; adding a new store starts with empty records. Stores are separate workspaces, not separate Firebase projects. The owner, Firebase project administrators and server service account have access across stores. All stores currently use USD and Central Time payroll periods; no consolidated payroll report or employee-transfer feature is included.

## Data and backup locations

Firebase Console → Firestore Database → Data:

- `stores/{storeId}`: name, location/geolocking, manager UID/email, active generation, manager PIN hash, kiosk UID/email and revision. Original store ID is `main`; new stores have generated IDs.
- `stores/{storeId}/generations/{generation}/employees`, `shifts`, `payRates`, `audit`: business data.
- `stores/{storeId}/backups/{backupId}/chunks`: JSON backup snapshots.
- `stores/{storeId}/attempts`: PIN lockouts (five incorrect attempts, five minutes).
- `stores/{storeId}/adminAudit`: owner manager assignments.
- `storeAccounts/{uid}`: transactional reservations separating manager and tablet identities.

Restores write a complete new generation before switching the pointer; concurrent edits abort that switch. Old generations remain for recovery.

Automatic backups occur after changes, not on a schedule. Backups in the SAME Firebase project do not protect against project deletion or administrator compromise. Keep periodic downloaded copies elsewhere; consider separately configuring scheduled Firestore backups/PITR. No off-project backup or scheduled job has been configured here.

There is no automatic retention cleanup yet. Each change copies a full snapshot and requests load store history. Costs grow with history/activity; add archiving and retention before scaling. Two maximum server instances do not cap total charges.

## Local development

Use `.env.local` with `MANAGER_UID=<manager UID>` and `gcloud auth application-default login`. The developer account needs project access.

Local development targets the REAL Firebase project unless both client and server are explicitly connected to emulators. Emulator ports are listed in firebase.json but application emulator wiring is not enabled. Use a separate project for destructive tests.

## Verification and rollback

Production build and 32 tests passed, including manager/tablet authorization, forged store IDs, cross-store writes and backup downloads, account reassignment, store-specific boundaries, and the geolocking switch. Route tests use verified mock identities and an in-memory database; live Firebase permissions, concurrent transactions, import/restore and tablet GPS still require testing. Before inviting managers, verify with two real manager accounts that each cannot access the other's store.

Keep the original export and old app. Before any new punches, rollback simply means resuming the old app. After new Firebase punches, export and reconcile those records BEFORE switching back to avoid losing hours.


## Employee email login and updates

Create each employee's Email/Password user in Firebase Authentication. In the selected store, open Manager, unlock with the manager PIN, and use Employee email access to link that email to an existing employee record. Repeat at the second store using the SAME Firebase email and that store's employee record. No public self-registration or manager-created passwords are provided. Employee accounts must be separate from manager, owner and tablet accounts. Employees clock themselves in/out without a PIN and see their own shift history, decimal completed hours, and estimated gross pay for Central Time semimonthly periods. Per-store salary calculations remain unchanged; dashboard totals sum the existing store amounts. Pay remains an estimate before deductions, without automatic overtime calculation.

Cross-store overlapping punches and manual shifts are blocked for linked employees, including punches made using the tablet PIN. Firestore transactions read the other assigned stores so concurrent mutations retry before committing conflicting shifts. Existing unlinked employee records cannot be recognized as the same person across stores. Assign accounts while employees are clocked out. Removing an email assignment removes access only at that store. Employee account assignments are access configuration stored outside backup generations; JSON shift backups/restores leave assignments unchanged. Recheck assignments after restoring a backup with different employee IDs. PIN access remains available.

Merge changes into the App Hosting deployment branch (`main`). Firebase rolls out the web update; installed PWA and Bubblewrap APK users get current pages when reopening/reloading while online. The service worker does not cache authenticated pages or API data. No APK rebuild or reinstall is needed for web UI/business-logic changes. An already-open screen may remain on its old version until refreshed. Changes to the Android package, signing key, permissions, icons or wrapper configuration require a new signed APK using the same keystore (or managed store distribution); website deployment does not update the Android binary.
