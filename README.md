# Store Time Clock

Multi-store time tracking with Firebase Authentication, Firestore, Next.js App Hosting and scheduled Cloud Functions.

- App: https://webbchapel--store-timeclock.us-east4.hosted.app
- Repository: https://github.com/sumansubedi25/StoreTimeClock
- Firebase project: `store-timeclock`
- App Hosting backend: `webbchapel`, region `us-east4`, deployment branch `main`
- Documentation updated October 6, 2026.

## Current status

The app has migrated to Firebase. Daily backups were deployed October 5 and updated October 6. Scheduled payroll PDF emails were deployed October 6; after replacing rejected Gmail credentials, the owner reported the manually triggered September report was working. The first regular October 1–15 report is scheduled for October 16 at 6 AM Central.

The latest UI fix (PR #20) makes Delete shift visible, including its disabled state and confirmation button. It is merged into main; successful App Hosting rollout and live mobile appearance still need confirmation. A repository merge alone does not prove a deployment succeeded.

## Accounts and permissions

- **Owner:** the Firebase UID configured by `MANAGER_UID` has access to all stores and can assign store managers.
- **Manager:** email/password login opens only assigned stores. Management tools and reports open without a PIN; changes and backup download/restore retain manager PIN authorization.
- **Employee:** individual email/password login; employees see their own shifts, decimal hours and estimated pay and can punch only for themselves. The same email can be linked to employee records at multiple stores.
- **Optional shared tablet:** a separate store account permits employee PIN punches and store status, not management or payroll. This remains supported, but personal employee logins are the preferred workflow.

Creating a Firebase Authentication user alone does not assign store access. Employees do not need ChatGPT accounts. Employee, manager and owner sessions sign out after two minutes of inactivity; this never ends a shift. Shared-tablet sessions are exempt.

### Employee enrollment and removal

Employees can register in the app, verify their email and request a store using its six-digit access code. The code appears beside the store name. A request does not grant access until the assigned manager or owner approves it using the manager PIN. Approval can link an existing employee record or create a new one; configure pay separately for new employees.

Existing Firebase emails can also be linked manually under Employee email access. New employee links, tablet assignments and manager assignments (including new stores) require the target Firebase account to have a verified email. Sign in and use **Verify account email** (or **Send verification email** on the access-request screen), open the email link, and sign back in before the manager retries. Existing assignments are not automatically revoked; review previously linked identities separately. An employee can request another store without losing existing assignments. Owner, manager, tablet and employee identities must remain separate.

**Remove employee · keep records** archives the selected store's employee, clears tablet PIN access and revokes that store's email assignment. Close open shifts first. Historical shifts/pay and access to other stores remain. This does not delete the Firebase login. There is no permanent employee-record deletion or reactivation UI.

## Hours, shifts and pay

- Central Time (`America/Chicago`); decimal hours; weekday and date in shift displays.
- Semimonthly periods: **1–15 and 16–month-end**, not rolling 15-day periods. Old records are retained.
- Hourly rates are effective per store/pay period; salary is a fixed amount **per pay period**.
- Estimates exclude active shifts from completed hours. No taxes, deductions, overtime premiums, benefits or payment processing are calculated.
- Different employees may overlap. The same employee cannot overlap within a store or across stores linked to their email.
- Managers can add, edit, delete or end a shift with a manager PIN and reason; changes are audited. To correct an active clock-in, edit the existing shift instead of adding another.
- **Delete shift:** Management tools → Authorize changes → Manual controls → Correct a shift → Edit shift/Edit clock out → enter a reason → Delete shift → confirm. The original times and reason remain in audit history.
- The dashboard's **Clocked in** card opens active shifts for manual clock-out.
- Hours & pay owed appears before manual controls and shift history. The redundant completed-shifts summary was removed.

## Location checks

When geolocking is enabled, both clock-in and clock-out require fresh, accurate coordinates inside the selected store's boundary. The manager can toggle it in Store name and location. Disabling it allows both punches without GPS; identity checks remain enforced. Employee email punches do not require a PIN; optional tablet punches do.

GPS is checked only at punches, not continuously, and coordinates are not saved. There is no automatic clock-out on departure. Browser location can be spoofed; real-device accuracy and denied-location behavior need live verification. Managers can make authorized manual corrections from any location.

## Backups and payroll emails

### Backups

Ordinary edits and punches **do not create backups**. `dailyStoreBackup` creates one daily backup per configured store at midnight Central, even with all devices off. Manual backups and before/after-restore safety copies remain. A delayed run reflects data when it executes, not historical point-in-time data.

Managers can download, restore and delete backups, including selecting multiple backups for deletion. Deleting a backup removes its chunks, not current employee records. There is no automatic retention cleanup. The first unattended daily run still needs confirmation in the app.

Backups are inside the same Firebase project. Download independent copies for recovery from project loss. Source ZIPs are not data backups. Account/store assignments, access requests and email report snapshots are outside JSON record backups. See [DAILY_BACKUPS.md](DAILY_BACKUPS.md).

### Payroll PDF emails

`payPeriodPayrollEmail` runs at **6 AM Central on the 1st and 16th**, reporting the period just ended. Each assigned manager receives their store report; the owner receives all store reports separately. PDFs include employee hours/rates/gross pay, store totals and detailed shifts. Open shifts and missing rates are flagged; salary calculations remain unchanged.

Gmail credentials live in Firebase Secret Manager, never in GitHub. The sender is the owner Firebase Authentication email. Reports are frozen snapshots; later corrections do not automatically resend them. Sent deliveries are skipped on retries; uncertain delivery requires review.

See [PAYROLL_EMAILS.md](PAYROLL_EMAILS.md) for configuration, logs and recovery. **Employee clock-out confirmation emails remain unimplemented.**

## Deployment and updates

### Website

Changes merged into `main` trigger App Hosting rollout. Check the Firebase console for successful rollout, then reopen/refresh the app online. Installed Android/iOS web apps and the Bubblewrap APK load updated web content without reinstalling. An already-open page can retain old code.

Android wrapper/signing/permission changes require a new signed APK. Preserve the signing keystore and `public/.well-known/assetlinks.json`. iOS uses Safari → Share → Add to Home Screen. A web app does not enforce Android kiosk locking.

### Local setup and validation

Use Node 22 (Cloud Functions runtime) and pnpm 11.25.0. From a fresh checkout or extracted source ZIP:

```sh
pnpm install --frozen-lockfile
npm --prefix functions ci
pnpm test
pnpm run build
```

For local server access, use `.env.local` with the configured owner `MANAGER_UID` and Application Default Credentials from an authorized developer account. Local development targets the real project unless both client and server are explicitly wired to emulators; emulator port declarations alone do not enable this. Use a separate project for destructive tests.

### Cloud Functions and rules

App Hosting does **not** deploy scheduled functions. After function changes:

```sh
npm --prefix functions ci
npx firebase-tools login
npx firebase-tools deploy --only functions:backups --project store-timeclock
```

The existing `backups` codebase contains both scheduled functions. Gmail secret setup is documented in PAYROLL_EMAILS.md. Credentials already configured for the live project need not be re-entered for ordinary UI updates.

Deploy reviewed Firestore rules separately when they change:

```sh
npx firebase-tools deploy --only firestore:rules --project store-timeclock
```

Direct browser Firestore access is denied. Server-side Admin SDK routes validate Firebase tokens and store roles. Do not replace rules with allow-all-signed-in-user access. Public Firebase web configuration is not an administrator credential.

Download [the current source ZIP](https://github.com/sumansubedi25/StoreTimeClock/archive/refs/heads/main.zip) if you do not use a local Git checkout. This requires no changes to existing college Git configuration. Keep one repository and Firebase project for all stores; no manually managed containers are necessary. Do not commit passwords, service-account keys, signing keys, `.env.local`, node_modules or build output.

## Adding stores

Create a separate manager email/password account in Firebase Authentication. As owner, open Manage stores → Add a store and enter its name, location, radius, geolocking choice and manager email. Coordinates are entered manually; the app does not geocode addresses. Default radius is 300 feet; accepted range is 20–1000 meters.

The assigned manager signs in to initialize the store's manager PIN and configure employee/pay records. Share the six-digit store code for employee access requests. A separate tablet account is optional.

Changing manager assignment revokes the previous manager's store access unless they retain another authorized role. It does not delete history or reset the store PIN. Original records remain in store ID `main`; new stores start empty. All stores use USD and Central Time periods.

## Data locations and restore

In Firebase Console → Firestore Database → Data:

- `stores/{storeId}`: store settings, access code, manager/tablet assignments, PIN hash, active generation and revision.
- `stores/{storeId}/generations/{generation}/employees|shifts|payRates|audit`: business records.
- `stores/{storeId}/backups/{backupId}/chunks`: JSON backups.
- `stores/{storeId}/payrollReports/{periodStart}` and `deliveries` subcollection: report snapshot and delivery status.
- `stores/{storeId}/attempts`: PIN lockout tracking.
- `stores/{storeId}/adminAudit`: owner assignment history.
- `storeAccounts/{uid}`: role reservations and employee store assignments.
- `storeAccessCodes/{code}`: unique store-code registry.

Import/restore replaces the selected store's business records. Store-tagged backups cannot be restored into another store; untagged legacy imports require deliberate selection. Restore writes a new generation before switching the pointer; concurrent edits abort that switch. Old generations remain. Access assignments/settings are not replaced by record restores; recheck employee mappings if IDs differ.

Before any import, download a current backup and compare employee counts, active shifts, hours, rates and totals afterward. Do not use production payroll records for destructive testing.

## Request hardening (October 6, 2026)

Clock and employee-management POSTs authorize store access using metadata and individual binding records before reading bodies or full store history. Access-request POSTs parse at most 10 KB to distinguish public submission from management; manager actions authorize before account lookup/history reads. Mutation transactions recheck permissions before loading collections. Public access submissions read store metadata, not employee/payroll history.

All POST routes count actual streamed body bytes and reject oversized payloads, including absent or misleading Content-Length. Normal requests are limited to 10,000 bytes. The 20,000,000-byte exception is restricted to manager-authorized `/api/clock?action=backup_import` with a matching body action; manager PIN and existing restore checks still apply. Reload older app pages before importing large backups.

These controls remove the identified full-history read amplification by unassigned accounts, but do not provide general rate limiting, a cost cap or protection from every denial-of-service scenario. GPS remains a deterrent based on client-supplied readings.

## Verification and remaining checks

As of October 6, **70 automated tests passed**, including the authorization/body-limit/email-verification hardening. Production build and TypeScript checks passed after those changes. Live mobile rendering of the earlier button contrast fix still needs confirmation.

Tests use mock identities, an in-memory database and fake mail transports. They cover payroll boundaries/DST, account/store isolation, geolocking, archiving, access approvals, shift conflicts, backups and email recipient/retry behavior. The owner reported the live September email test worked after a Gmail credential replacement; this is not a comprehensive security audit or proof that every manager received a message.

Remaining live checks include real Firebase role/permission boundaries, concurrent Firestore writes, import/restore recovery in a separate test environment, device GPS behavior and unattended scheduler execution. Do not infer these passed from the unit-test count. Review totals before paying employees.

For rollback, retain downloaded data backups and identify the previous working App Hosting release. Preserve/reconcile new shifts before returning to older data or another system. See [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for feature history and operating notes.
