# Daily backups

Status October 6, 2026: deployed by the owner October 5 and successfully updated October 6. The first unattended daily entry still needs confirmation. The steps below are for deployment/recovery, not a requirement to activate it again.

The app no longer creates a backup after each saved edit or punch. Managers can create, download, restore, or delete backups. Deletion removes the backup and its chunks, not current records. Restore still makes before/after safety copies.

The scheduled function creates one backup per configured store at midnight America/Chicago, even if nobody opens the app. A snapshot reflects data when the job runs; a delayed job is not a historical point-in-time snapshot. Daily backups use the existing app backup format. Email role assignments remain outside that format.

Firebase App Hosting deploys the website from GitHub but does not deploy this scheduled function. For deployment, open a fresh main-branch ZIP in Terminal (or update an existing Git checkout). ZIP downloads do not change your college Git settings. From that folder:

```sh
npm --prefix functions ci
npx firebase-tools login
npx firebase-tools deploy --only functions:backups --project store-timeclock
```

Use the Google account that owns the Firebase project. The project needs Blaze billing and the Cloud Scheduler API. The Firebase CLI creates the schedule and its authenticated invocation automatically; do not make the function public.

After successful deployment, open Google Cloud Scheduler for project `store-timeclock`, locate `firebase-schedule-dailyStoreBackup-us-east4`, and use **Force run** once to verify it. Refresh Backups in the app and confirm a **Daily** entry. A forced run is a current snapshot, not a reconstruction of yesterday. The regular schedule is `0 0 * * *` in America/Chicago.

If scheduling is unavailable, use **Create backup now**. Existing backups are preserved until you explicitly delete them; no retention cleanup is enabled.
