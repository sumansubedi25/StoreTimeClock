# Store Time Clock — Firebase migration

This Firebase version is not yet deployed and contains no live employee data. The old app is still the live system.

## Included

Firebase email/password login; separate manager and tablet roles; employee PIN punches; decimal hours; manual shift edits with audit records; twice-monthly hourly/salary gross-pay estimates; JSON backups and imports; installable web-app assets.

Pay periods are 1st–15th and 16th–month-end in America/Chicago. Salary rate means the amount PER PAY PERIOD. No taxes, overtime, benefits, or actual payroll payments are calculated. Review totals before paying employees.

Clock-in requires a fresh GPS reading within 300 feet of 9625 Webb Chapel Rd Suite 100A, Dallas. Clock-out does not require GPS. Coordinates are not saved. Browser GPS can be spoofed and location accuracy must be tested on your tablet. A web app cannot enforce Android kiosk locking.

## 1. Preserve old data

In the old app's manager Backups panel, create and DOWNLOAD a JSON backup. Store a copy separately. Source-code ZIPs are NOT employee-data backups.

For the final cutover, pause punches on the old app and export a final backup. The two apps do not synchronize. Keep the old app until the imported hours and pay totals have been checked.

## 2. Prepare Firebase

Project: `store-timeclock`. Public web configuration is already included in `lib/firebase-client.ts`; it is not an administrator credential.

1. Authentication → Sign-in method → enable Email/Password.
2. Authentication → Users → create manager and SEPARATE store tablet accounts. Employees only need PINs, not Firebase or ChatGPT accounts.
3. Click the manager user, copy its UID, and replace `REPLACE_WITH_MANAGER_UID` in `apphosting.yaml`. Only this UID gets manager access. Do not share passwords or service-account keys.
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

Create ONE private GitHub repository. Upload project files at the repository root, including `.firebaserc`, `.gitignore`, and `.env.example`. Do not upload node_modules, .next, .env.local, or credentials.

Firebase Console → App Hosting (not static Hosting) → create a backend → connect the repository → select your live branch and root folder → deploy. No manually managed container is needed. This is a dynamic Next.js app, not a static HTML export.

App Hosting supplies server Application Default Credentials. If runtime logs report permissions errors, check the backend runtime service account's IAM permissions for Firestore read/write and Firebase Authentication user/token access. Grant only the missing permissions to that service account, never the public or employees.

Add the deployed hostname to Authentication → Settings → Authorized domains.

Official guides:
- https://firebase.google.com/docs/app-hosting/get-started
- https://firebase.google.com/docs/app-hosting/about-app-hosting

## 4. Import, test, and switch

Sign into the NEW HTTPS URL using the manager Firebase account. On the setup screen choose Import an existing backup and select the old JSON backup. Employees, hashed PINs, shifts, rates, audit records, and manager PIN are restored. Firebase account authorization remains unchanged. Import into an initialized store requires its current manager PIN and replaces business records.

Check employee counts, open/closed shifts, recent hours/pay totals, and audit history against the original app. If validation fails, keep the original data intact and investigate.

Manager controls → Store tablet access → enable the separate tablet email. On the tablet sign into THAT account, never your manager, Google, or ChatGPT account. Verify payroll, reports, backup and edit actions are denied.

Test wrong PINs, location clock-in, clock-out, manual manager edits, and backup download/restore with a test employee. Do not migrate employees until live tests pass.

Android Chrome on the new HTTPS URL → Install app/Add to Home screen if offered. Internet is required for punches. Strong kiosk security requires a managed Android dedicated-device solution using lock task mode and an owner-only exit password. Ordinary screen pinning is not equivalent. Enrollment may require a factory reset; back up the device first.

## Data and backup locations

Firebase Console → Firestore Database → Data:

- `stores/main`: active generation, manager PIN hash, kiosk UID/email and revision.
- `stores/main/generations/{generation}/employees`, `shifts`, `payRates`, `audit`: business data.
- `stores/main/backups/{backupId}/chunks`: JSON backup snapshots.
- `stores/main/attempts`: PIN lockouts (five incorrect attempts, five minutes).

Restores write a complete new generation before switching the pointer; concurrent edits abort that switch. Old generations remain for recovery.

Automatic backups occur after changes, not on a schedule. Backups in the SAME Firebase project do not protect against project deletion or administrator compromise. Keep periodic downloaded copies elsewhere; consider separately configuring scheduled Firestore backups/PITR. No off-project backup or scheduled job has been configured here.

There is no automatic retention cleanup yet. Each change copies a full snapshot and requests load store history. Costs grow with history/activity; add archiving and retention before scaling. Two maximum server instances do not cap total charges.

## Local development

Use `.env.local` with `MANAGER_UID=<manager UID>` and `gcloud auth application-default login`. The developer account needs project access.

Local development targets the REAL Firebase project unless both client and server are explicitly connected to emulators. Emulator ports are listed in firebase.json but application emulator wiring is not enabled. Use a separate project for destructive tests.

## Verification and rollback

Production build and 11 business-logic/import tests passed. Live Firebase permissions, import/restore and tablet GPS still require testing.

Keep the original export and old app. Before any new punches, rollback simply means resuming the old app. After new Firebase punches, export and reconcile those records BEFORE switching back to avoid losing hours.
