# Recovery delivery operations

## Key and readiness

RECOVERY_DELIVERY_KEY is a dedicated standard Base64 encoding of 32 random bytes, distinct from APP_SECRET and assignment encryption keys. It belongs in the ignored project-root .env with mode 0600. The committed template intentionally has an empty value. Do not paste keys into logs, chat, command arguments, tickets or version control. Recovery issuance/delivery fails closed when the key is unavailable; unrelated foundation commands remain available. This task does not provision the real key or claim main development recovery readiness.

API and notification worker must load the same environment and key. Use one active key for version-1 envelopes. Before replacing it, drain pending delivery or explicitly cancel/purge protected work under an authorized operational procedure; do not overwrite a key needed by pending ciphertext. An envelope format version is not a historical key ring. Keep an encrypted offline secret backup separately from database backups and restrict access to authorized operators. Restore pending work only with its matching key, and verify on an isolated database/capture environment before relying on restoration.

## Delivery boundary

Reset validation records store only token digests. Delivery records retain authenticated ciphertext/nonce while retryable work is pending. Messenger contains delivery IDs, not plaintext links. The worker reloads authoritative request/account state, locks account then request then work, and sends synchronously. New issuance supersedes old tokens and cancels/purges pending old delivery; successful reset consumes the request and cancels/purges its pending work. Expired/used/superseded work is also cancelled by bounded worker housekeeping. No external email already accepted by SMTP can be recalled.

Success, terminal failure and cancellation clear ciphertext/nonce, leaving sanitized status. Messenger schedules five retries after the initial attempt using the configured positive NOTIFICATION_RETRY_BASE_MS, multiplier two, zero jitter and no cap. Status mirrors the retry envelope rather than starting another scheduler. A transport failure must not create another token or change the password. A crash after SMTP acceptance but before committed success can produce a duplicate; stable Message-ID reduces avoidable duplicates but does not guarantee exactly-once external delivery.

Run the existing notification worker after explicit migrations. Missing schemas are not created by startup or handlers. Diagnose using delivery ID, state, status_code, attempt/retry count and due time; never log the email body, bearer token, key or transport exception payload. Capture development email with Mailpit only. Production SMTP/sender credentials remain deployment inputs.

## Link and client contract

Recovery/reset require JSON and a session-bound CSRF token, including anonymous sessions. Public recovery acknowledgement does not disclose whether the normalized email/phone exists. The link uses trusted APP_PUBLIC_URL and /password-reset#token=...; reject userinfo/query/fragment in configured base URLs and require HTTPS in production. Tokens never enter a server GET URL. The future Vue reset screen must read the fragment into memory, replace history to clear it, and POST token/password without logging or analytics. A valid reset does not log the user in automatically or introduce another global-session logout policy.

## Local verification

scripts/check mail uses an owned tmpfs test database, local Mailpit and disposable keys generated inside test processes. Real root dotenv secrets are not modified. Worker/native HTTP children inherit the synthetic key only for that invocation; teardown removes test resources. Tests must never send recovery mail to external SMTP. Passing local capture evidence is not production SMTP/TLS/browser acceptance.

A retry can be durably queued just before a worker exits without recording its status projection. On receiving a recovery retry, middleware restores the observed retry count from Messenger's RedeliveryStamp before handling; it never schedules another retry. Older events cannot lower the recorded count or reopen terminal work. This covers projection recovery without claiming an atomic transaction across SMTP acceptance and database commit.
