# Store Time Clock — project context

Updated October 4, 2026. This is a long-term business time-clock app, initially for three employees, supporting multiple stores and separate managers.

## Project

- Repository: https://github.com/sumansubedi25/StoreTimeClock
- Live app: https://webbchapel--store-timeclock.us-east4.hosted.app
- Firebase project: store-timeclock
- App Hosting backend: webbchapel, us-east4
- Deployment branch: main. Changes merged into main trigger a Firebase rollout.
- Firebase Authentication handles email/password login; server-side Firebase Admin checks permissions and reads/writes Firestore. Direct browser Firestore access is denied by firestore.rules.

## Roles and employee workflow

The owner retains access to all stores and manager controls. Ownership is configured using the Firebase UID in MANAGER_UID, not by email matching. Managers have assigned stores and use each store's manager PIN for controls.

Current preferred workflow: employees use their own phones and email accounts, rather than shared store tablets. Create their email/password login in Firebase Authentication, then link it to an employee record using Manager → Employee email access. Authentication alone does not assign a role; Firestore stores permissions.

One email may be linked to employee records at multiple stores. Employees can clock only themselves in/out and view only their own shifts, decimal hours, and estimated gross pay, including per-store and combined period totals. Removing email access revokes only the selected store while retaining hours/pay history and other store assignments. It does not delete the Firebase login. Full employee deactivation is not implemented. Existing PIN/tablet access remains implemented but is not the current preferred workflow.

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

Store records and chunked JSON backups are in Firestore. Account/store assignments are outside backup generations and stay unchanged by JSON restores. Recheck employee mappings when restoring different employee IDs. Independent downloaded backups protect against losing the Firebase project; do not claim scheduled backups or retention cleanup are configured.

Employee email access: PR #1. Geolocking for clock-out: PR #2. Latest validation: 32 automated tests and Next.js production build/TypeScript checks passed. Tests use in-memory Firebase substitutes; actual Firebase permissions and phone GPS need live verification. Preserve existing live data during changes.

## Pending, not implemented

Email confirmation to employees after clock-out, including shift details and period totals. After each semimonthly period, reports of hours and estimated pay to each store's manager, with all store reports copied to the owner. Requirements confirmed, but email provider configuration, scheduler and delivery are NOT implemented.

## Working preferences

Give short, concrete next steps. User often supplies screenshots and replies 'done'. Explain how each deployment reaches installed apps. Update this document when project behavior changes. Use the GitHub connector for repository changes; avoid unnecessary repeated permission requests.

Employee setup is email-first: add name without an employee PIN, then link Firebase Auth email in Employee access. New employees have a null PIN hash; backup restore supports this. Manager PIN remains required. Existing shared-tablet PINs are preserved; optional tablet PIN setup/reset is under Edit employee → Optional shared-tablet PIN.

Employee, manager, and owner screens sign out after two minutes without trusted user interaction. Returning from background checks elapsed wall-clock time before accepting activity; last activity survives reloads. Signing back in requires Firebase email/password. Shared-tablet kiosk sessions remain exempt. This UI inactivity lock never clocks an employee out or ends their shift.

Backup policy updated: no backups after ordinary edits, employee access changes, or punches. Managers can delete backups and all their chunks with manager PIN confirmation. Manual backups and before/after restore safety copies remain. functions/dailyStoreBackup runs at midnight America/Chicago once deployed separately; GitHub App Hosting rollout alone does not activate the scheduler. See DAILY_BACKUPS.md for activation. No automatic deletion/retention policy.

Managers can remove an employee under Employee email access using Remove employee · keep records. This archives the record with archivedAt, clears tablet PIN access, and atomically unlinks only that store's email assignment. Open shifts must be closed first. Active lists exclude archived staff; historical shifts and pay remain. Salary remains unchanged for the archive pay period, then archived staff are excluded from future payroll unless a shift overlaps that period. Backups preserve archive state. Archived employees are listed in the Employee access panel; there is no permanent record deletion or reactivation UI.

## Employee access requests (October 6, 2026)
- Public employee signup uses Firebase email/password; email verification required before submitting a store request. Existing manager/kiosk/owner logins cannot request employee access.
- Managers share the store code shown in Employee access requests under Management tools. No public store list is exposed.
- Requests are pending until that store’s manager/owner approves with manager PIN. Manager can create a new employee without tablet PIN, or link an unlinked active employee to preserve history and pay settings. New employees need their rate set separately; existing salary settings remain unchanged.
- Employees request additional stores from Request another store; approvals add assignments without replacing other stores. Active shifts block account reassignment.
- Pending/rejected accounts cannot read or punch. Resolution is atomic and repeated approvals are refused; daily resubmission cooldown and ten-store cap limit requests. Requests and assignments are outside record backups.
- Daily backup function was deployed by the owner October 5, 2026; first scheduled run still needs confirming in the app.
