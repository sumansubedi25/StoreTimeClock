# Scheduled payroll PDF emails

Code is ready; email delivery starts only after the Gmail secret is configured and the Cloud Function is deployed. GitHub/App Hosting website releases do not deploy these functions.

## Schedule and recipients

At 6:00 AM America/Chicago on the 16th, report the 1st–15th. On the 1st, report the 16th–last day of the previous month. Each store's assigned manager receives only that store's PDF. The owner receives every store report as separate emails. Current email addresses come from Firebase Authentication; disabled accounts are excluded. A missing/disabled manager does not prevent the owner's report. A manager who is also the owner receives one copy.

PDFs contain employee hours, configured rates, estimated gross pay, store totals and detailed shifts. Open shifts and missing rates are flagged. Calculations match the app, including unchanged fixed salary amounts. These are gross estimates, not tax calculations or payments.

## Activate on your Mac

1. Download a fresh main-branch ZIP from https://github.com/sumansubedi25/StoreTimeClock/archive/refs/heads/main.zip and extract it. Use the newly extracted folder, not an older copy. No Git login or changes to your college Git configuration are needed.
2. Open Terminal, type `cd ` with a trailing space, drag the new folder into Terminal, and press Return.
3. Install function dependencies and log into the owner Firebase account:

```sh
npm --prefix functions ci
npx firebase-tools login
```

4. In the Google account matching the owner's Firebase Authentication email, enable 2-Step Verification and create an App Password named Store Time Clock: https://myaccount.google.com/apppasswords . A separate App Password lets you revoke this app independently of the local payroll app. Do not use your normal Gmail password.
5. Run this command and paste the App Password only at its secure prompt. Never put it in chat, GitHub, or a source file:

```sh
npx firebase-tools functions:secrets:set PAYROLL_GMAIL_APP_PASSWORD --project store-timeclock
```

6. Deploy the functions codebase (preserves the existing daily backup function and adds payroll email):

```sh
npx firebase-tools deploy --only functions:backups --project store-timeclock
```

If asked about PAYROLL_OWNER_UID, keep the default `CRWIoygqx9fYs2RJlQsBhLiCUT12`. The Gmail sender must be that user's current Firebase Authentication email. Keep the existing seven-day container-image cleanup setting if prompted. The function runtime is Node 22.

## Verify and monitor

Confirm `payPeriodPayrollEmail` deployment succeeds and its Cloud Scheduler job is enabled in us-east4. The job normally has the name `firebase-schedule-payPeriodPayrollEmail-us-east4`. Check function logs after its scheduled run:

```sh
npx firebase-tools functions:log --only payPeriodPayrollEmail --project store-timeclock
```

A manual Run now sends REAL reports for the most recently closed period, not the current unfinished period. Do not use it casually as a test. Gmail delivery from the deployed environment still needs verification; local automated tests use fake email transports and send no mail.

Firestore stores a frozen report in `stores/{storeId}/payrollReports/{periodStart}` and delivery status in its `deliveries` subcollection. Sent deliveries are skipped on retries. If Gmail's response is uncertain, status becomes `needs_review`; automatic resend is blocked to avoid duplicates. Check Gmail Sent and function logs before attempting recovery. Do not delete sent delivery records to retry a report. A later correction in the app does not automatically replace or resend an existing report snapshot.

Report snapshots persist until explicitly removed and are separate from the app's JSON record backups. Report documents and secrets are accessible through server/admin access, not employee Firestore client access. There is no public email-trigger endpoint.

Clock-out confirmation emails are a separate pending feature and are not enabled by this deployment.
