# Clock-in and clock-out confirmation emails

Successful `in` and `out` requests commit an event under `stores/{storeId}/punchEmails/{generation}-{shiftId}-{action}` in the same transaction as the shift. Failed punches, manual corrections, imports and restores do not create notifications. An email failure cannot roll back an already saved shift.

The `punchConfirmationEmail` Cloud Function scans up to 20 pending events per store every minute. Normal delivery is approximately one to two minutes plus provider delay; this is not an instant-delivery guarantee. Events queued before the function is deployed remain pending and will be processed afterward.

Each event sends separate messages to the employee's linked Firebase identity and the store manager at punch time. Both identities must still have the relevant store assignment and an enabled, verified email when delivery runs. Main store falls back to the owner as manager. Other stores do not add an owner copy. Missing employee email access, removed/disabled/unverified identities and changed manager assignments are skipped. Messages include store, employee, Central Time punch timestamp, and completed decimal hours on clock-out. No PINs, GPS coordinates, salary/rates, or other employees' records are emailed.

## Activate

GitHub/App Hosting deploys only the website. This worker must be deployed separately from the repository root using a Firebase-authorized account:

```sh
git pull
npm --prefix functions ci
npx firebase-tools login
npx firebase-tools deploy --only functions:backups --project store-timeclock
```

It reuses `PAYROLL_GMAIL_APP_PASSWORD` and `PAYROLL_OWNER_UID` from the existing payroll sender. The sender must be an enabled, email-verified Firebase account, and its Gmail app password must already be valid. Do not commit credentials. No Firestore rules change is required; direct browser writes remain denied.

## Verification and recovery

After deployment, confirm a real authorized clock-in/out queues an event, the scheduled function runs, and the employee and manager each receive the appropriate confirmation. Confirm a rejected punch creates no event. Use test staff/records for live testing, not artificial production shifts.

The worker marks `processedAt` and status on the event. Per-recipient status is under its `deliveries` collection. A sent recipient is skipped on retries. SMTP errors after sending begins are ambiguous: they become `needs_review` rather than being resent automatically. The other recipient is still attempted. Inspect function logs, event delivery states, and the recipient mailbox before any deliberate recovery. Never clear a sent or ambiguous delivery record blindly. Pre-send transient failures remain pending for a future scheduled run. SMTP cannot guarantee exactly-once delivery.

These event and delivery records are outside the existing business-record JSON backups and have no automatic retention cleanup. Restoring business records does not replay emails.

Disable the Cloud Scheduler job for this function to pause sending; saved shifts continue to work and new events remain queued.

## Recovering a premature payroll test

Payroll now refuses to finalize a period that has not ended in real time. If an
existing payroll snapshot was generated before its period ended, the worker
preserves that document and its delivery receipts and creates a fresh snapshot
under `payrollReports/{periodStart}-final`. Final deliveries have their own
receipts and remain deduplicated on retries. Valid closed-period snapshots keep
their existing delivery behavior. This does not change punch email delivery.

After deploying `functions:backups`, run the existing payPeriodPayrollEmail
Cloud Scheduler job once to recover the most recently closed period. During
October 16–31 this selects October 1–15. Deployment alone does not run payroll.
Verify the final report and receipts for each store; do not delete the original
test report. Reports reflect recorded shifts at snapshot time, including any
manager corrections made since period close.
