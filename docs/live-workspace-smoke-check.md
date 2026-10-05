# Live Workspace smoke check

Use dedicated managed test accounts and a disposable application database. Never place their
credentials or a Playwright storage-state file in the repository.

1. Configure the Google OAuth client as internal, enable Admin SDK, and add
   `<BETTER_AUTH_URL>/api/auth/callback/google` as a redirect URI.
2. Set `GOOGLE_REVIEWER_ROLE_ID` to the immutable ID of the Google Workspace role permitted to
   review signup requests. Assign it to the reviewer test account, directly or through a group.
3. Sign in as the reviewer and confirm `/review` shows only database records whose status is
   `verified`, then open one record and confirm its applicant details.
4. Sign in as a managed account without that role and confirm `/review` shows `Review access
denied` without any request data.
5. Revoke the reviewer grant in Google, reload `/review`, and confirm `Reconnect your Google
account` without request data. Sign in again and confirm access is restored.
6. Temporarily remove the reviewer profile from Directory visibility or disable Directory access,
   reload `/review`, and confirm `Workspace access unavailable` without request data. Restore the
   tenant configuration afterward.

Google credential and Directory changes propagate asynchronously. Record the observed time to each
outcome; this check is not a claim of instantaneous suspension detection.
