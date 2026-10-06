# Store Time Clock — project context

Updated October 6, 2026. This is a long-term business time-clock app, initially for three employees, supporting multiple stores and separate managers.

## Project

- Repository: https://github.com/sumansubedi25/StoreTimeClock
- Live app: https://webbchapel--store-timeclock.us-east4.hosted.app
- Firebase project: store-timeclock
- App Hosting backend: webbchapel, us-east4
- Deployment branch: main. Changes merged into main trigger a Firebase rollout.
- Firebase Authentication handles email/password login; server-side Firebase Admin checks permissions and reads/writes Firestore. Direct browser Firestore access is denied by firestore.rules.

## Roles and employee workflow

The owner retains access to all stores and manager controls. Ownership is configured using the Firebase UID in MANAGER_UID, not by email matching. Managers have assigned stores; their Firebase email login and server-side store role open reports and management tools without an entry PIN; changes retain manager PIN authorization.

Current preferred workflow: employees use their own phones and email accounts. They can register, verify email, and request access using the six-digit store code; manager approval links an existing employee or creates a new record. Manually linking an existing Firebase Authentication email under Employee email access remains supported. Authentication alone does not assign a role; Firestore stores permissions.

One email may be linked to employee records at multiple stores. Employees can clock only themselves in/out and view only their own shifts, decimal hours, and estimated gross pay, including per-store and combined period totals. Removing email access revokes only the selected store while retaining hours/pay history and other store assignments. It does not delete the Firebase login. Employee removal archives records and revokes access for the selected store. Existing PIN/tablet access remains implemented but is not the current preferred workflow.

## Hours, pay and location

- America/Chicago time zone; decimal hours.
- Semimonthly pay periods: 1–15 and 16–month-end. Prior records remain saved. Reopen/refresh and select the new period at a boundary.
- Hourly rates are per store and effective period. Existing salary calculations remain per store/per period; the user requested no redesign of salaried employees.
- Pay is estimated gross pay; no automatic taxes, benefits, overtime or payment processing.
- When a store's geolocking is on, BOTH clock-in and clock-out require fresh, accurate location inside that store's boundary. Off permits both without GPS.
- Location is checked at punches, not continuously, and is not stored. Automatic departure clock-out was declined.
- Different employees may overlap shifts. The same employee cannot overlap within a store or, when linked to the same email, across stores.
- To change an active shift's clock-in time, edit the existing shift, keep its end unset, and provide a reason. Do not add a duplicate shift. Managers can manually correct shifts.

## Installation and updates

Android: installed web app or signed Bubblewrap APK. User's Mac project directory: ~/StoreTimeClockAndroid. Signing alias: android. Keep signing keystore/password private and backed up; never commit them.

Android package: app.hosted.us_east4.webbchapel__store_timeclock.twa. Preserve public/.well-known/assetlinks.json and the signing identity.

iOS: Safari → Share → Add to Home Screen. User chose this instead of a native iOS app and does not want public app listings.

Firebase website deployments update Android/iOS web apps and the existing APK when reopened/refreshed online after rollout succeeds. An already-open page may retain old code until refreshed. Website changes do not require reinstalling the APK. Changes to the native package, signing, permissions or wrapper need a new signed APK.

## Data and validation

Store records and chunked JSON backups are in Firestore. Account/store assignments are outside backup generations and stay unchanged by JSON restores. Recheck employee mappings when restoring different employee IDs. Independent downloaded backups protect against losing the Firebase project; Daily backup scheduling was deployed October 5, 2026; automatic backup retention cleanup is not configured.

Employee email access: PR #1. Geolocking for clock-out: PR #2. Latest full automated run: 70 tests passed after request/assignment hardening; production build and TypeScript checks passed. Live mobile rendering of the earlier button-contrast fix remains unconfirmed. Tests use in-memory Firebase substitutes; actual Firebase permissions and phone GPS need live verification. Preserve existing live data during changes.

## Pending, not implemented

Email confirmation to employees after clock-out remains unimplemented. Scheduled semimonthly PDF payroll reports were deployed October 6. Gmail initially rejected credentials; after a new App Password and redeployment, the owner reported the September manual test was working. Individual manager receipt and unattended scheduled execution have not been independently verified. See PAYROLL_EMAILS.md.

## Working preferences

Give short, concrete next steps. User often supplies screenshots and replies 'done'. Explain how each deployment reaches installed apps. Update this document when project behavior changes. Use the GitHub connector for repository changes; avoid unnecessary repeated permission requests.

Employee setup is email-first: add name without an employee PIN, then link Firebase Auth email in Employee access. New employees have a null PIN hash; backup restore supports this. Manager tools and reports open with the signed-in manager/owner session; changes still require the manager PIN. Existing shared-tablet PINs are preserved; optional tablet PIN setup/reset is under Edit employee → Optional shared-tablet PIN.

Employee, manager, and owner screens sign out after two minutes without trusted user interaction. Returning from background checks elapsed wall-clock time before accepting activity; last activity survives reloads. Signing back in requires Firebase email/password. Shared-tablet kiosk sessions remain exempt. This UI inactivity lock never clocks an employee out or ends their shift.

Backup policy updated: no backups after ordinary edits, employee access changes, or punches. Managers can delete backups and all their chunks using manager email authorization, manager PIN, and a deletion confirmation. Manual backups and before/after restore safety copies remain. functions/dailyStoreBackup runs at midnight America/Chicago once deployed separately; GitHub App Hosting rollout alone does not activate the scheduler. See DAILY_BACKUPS.md for activation. No automatic deletion/retention policy.

Managers can remove an employee under Employee email access using Remove employee · keep records. This archives the record with archivedAt, clears tablet PIN access, and atomically unlinks only that store's email assignment. Open shifts must be closed first. Active lists exclude archived staff; historical shifts and pay remain. Salary remains unchanged for the archive pay period, then archived staff are excluded from future payroll unless a shift overlaps that period. Backups preserve archive state. Archived employees are listed in the Employee access panel; there is no permanent record deletion or reactivation UI.

## Employee access requests (October 6, 2026)
- Public employee signup uses Firebase email/password; email verification required before submitting a store request. Existing manager/kiosk/owner logins cannot request employee access.
- Managers share the store code shown in Employee access requests under Management tools. No public store list is exposed.
- Requests are pending until that store’s manager/owner approves using their signed-in manager account and manager PIN. Manager can create a new employee without tablet PIN, or link an unlinked active employee to preserve history and pay settings. New employees need their rate set separately; existing salary settings remain unchanged.
- Employees request additional stores from Request another store; approvals add assignments without replacing other stores. Active shifts block account reassignment.
- Pending/rejected accounts cannot read or punch. Resolution is atomic and repeated approvals are refused; daily resubmission cooldown and ten-store cap limit requests. Requests and assignments are outside record backups.
- Daily backup function was deployed by the owner October 5, 2026; first scheduled run still needs confirming in the app.

## Manager layout and six-digit access codes (October 6, 2026)
- Every store receives a stable, randomly allocated six-digit accessCode on its first authorized store listing. A transaction reserves storeAccessCodes/{code} uniquely; collisions retry. Store IDs and all records remain unchanged.
- The signed-in page header shows the current store name and its six-digit code. Employee requests accept accessCode only, resolve it server-side, and still require verified email and store manager approval. Raw IDs such as main are no longer access codes.
- Manager dashboard has one Management tools button. Opening it immediately loads reports without a manager PIN. Server-side manager/store authorization protects every route. Read-only manager views open without PIN; mutations and backup download/restore retain PIN authorization through Authorize changes on the tools page. Tablet PIN checks and personal employee restrictions remain enforced.
- Management page order starts Hours & pay owed, Manual controls, Shift history, then administrative panels. The all-time Completed shifts summary card is removed.
- Validation: 51 tests passed, production build/TypeScript passed, and rendered manager UI checks verified button count, no PIN gate, removed completed card, and section order.

## Dashboard manual clock-out (October 6, 2026)
- Manager dashboard Clocked in count is an accessible button opening a fresh list of active shifts.
- Select an employee, choose Now or a custom clock-out time (device timezone displayed), enter manager PIN and reason, then Confirm clock out.
- Uses the existing save_shift endpoint with exact shift ID, original start/end, and unchanged clock-in time. Existing authorization, stale-edit/overlap validation, and audit history remain enforced. Managers can do this from any location.
- Success refreshes the dashboard and removes the completed shift from the dialog. Failed/stale saves retain the form and show the error. Tablet/employee dashboards do not expose this control.
- Validation: production build/TypeScript passed; exercised component flow verified payload, PIN/reason, success refresh and stale-shift error handling.

## Scheduled payroll PDF emails (October 6, 2026)
- payPeriodPayrollEmail runs at 06:00 Central on the 1st and 16th for the last closed semimonthly period. Existing daily backup schedule is unchanged.
- Gmail SMTP sender is the owner Firebase Auth email. PAYROLL_GMAIL_APP_PASSWORD is a Firebase secret; PAYROLL_OWNER_UID defaults to the existing owner UID. No credentials belong in the repository.
- Each store manager receives their own report; owner receives all reports. Current enabled Firebase Auth accounts and store manager assignment are checked immediately before sending.
- PDFs include employee hours/rates/gross pay, store totals and detailed shifts, with open shifts/missing rates flagged. Salary calculations are unchanged.
- Frozen report snapshots and per-recipient delivery status are stored under stores/{id}/payrollReports/{periodStart}. Sent deliveries are skipped. Uncertain SMTP outcomes require review, not blind resend. Later corrections do not automatically resend the snapshot.
- Activated October 6 by owner deployment. Gmail credentials were replaced after an SMTP 535 failure; the owner then reported the September manual test working. App Hosting rollout alone does not deploy functions. First regular October report is due October 16 at 06:00 Central.

## Shift button visibility (October 6, 2026)
- PR #20 merged explicit red Delete shift styling, a readable disabled state and navy Save changes styling, including the deletion confirmation action and narrow-screen wrapping.
- Manager PIN, reason requirement, confirmation and audit behavior remain unchanged. TSX syntax/CSS reviewed; App Hosting rollout completion and live mobile appearance still need confirmation.

## Authorization and email-link hardening (October 6, 2026)
- Clock/employee POSTs use metadata and individual bindings before body/full-state reads; access-request manager actions authorize before target lookup/history reads. Transaction-level checks protect against concurrent reassignment. Public submissions never load business collections.
- Streamed request bodies are capped at 10,000 bytes. Only manager-authorized /api/clock?action=backup_import permits 20,000,000 bytes and requires the matching body action. Import UI updated; existing PIN/restore checks retained.
- Manual employee link, tablet assignment and manager assignment/store creation require account.emailVerified. Existing assignments are preserved, not retroactively audited or revoked. Verify account email is available in the signed-in header; unassigned accounts also have Send verification email.
- Validation: 70 tests passed, including read instrumentation, transaction reassignment, streamed limits/cancellation, valid large backup import with PIN enforcement and rejection of unverified assignments. Production build/TypeScript passed. No production employee data changed during implementation; live verification remains needed after rollout.
