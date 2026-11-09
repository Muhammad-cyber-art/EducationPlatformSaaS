# Backend hardening

## General deployment verification (2026-11-09)

The current working tree passed the following checks after the lifecycle fixes:

| Check | Result |
| --- | --- |
| Full backend suite on isolated SQLite | 215 tests discovered; 211 passed, four PostgreSQL-only tests skipped. |
| Full backend suite on isolated PostgreSQL 18.1 | All 215 tests passed, including concurrent payments/replay, tenant migrations and the 19 lifecycle regressions. The temporary cluster listened only on `127.0.0.1:55439` and was stopped after testing. |
| Migration drift | `makemigrations --check --dry-run --settings=config.test_settings`: no changes detected. |
| Frontend production build | Passed with `npm run build -- --configLoader native`; service worker/precache generated. |
| Frontend lint | Exit zero: zero errors, 111 warnings. No frontend automated test script is configured. |
| Frontend dependency lock | Installed package versions matched `frontend/package-lock.json`. |
| Python dependencies | `pip check`: no broken installed requirements. Installed versions do differ from five deployment pins; see below. |
| Application startup components | WSGI/Celery imports and isolated `collectstatic` passed. Notification tasks route to the `notifications` queue. This does not test a live broker or delivery. |
| Deployment files | Compose YAML parsed with nine services, valid dependency names and bounded logging; entrypoint shell syntax, Python compilation and diff whitespace checks passed. |

Docker production environment was checked using the root `.env` without loading
the development-only `backend/.env` (the latter is excluded from the image).
`DEBUG=False`, production mode and secure session/CSRF cookies were confirmed.
Security checks reported two warnings: HSTS is disabled and Django's SSL redirect
is disabled. The checked Nginx configuration redirects HTTP to HTTPS; the actual
server/certificate installation was not inspected. Running directly against
`backend/.env` instead uses development settings and is not equivalent to Docker.

The test runtime was Python 3.14.4/PostgreSQL 18.1/Node 24.15.0, while Compose
targets Python 3.12/PostgreSQL 15/Node 20. Installed dependency differences from
`requirements.txt` were DRF 3.18.1 vs 3.18.0, NumPy 2.5.3 vs 1.26.4,
psycopg2-binary 2.9.13 vs 2.9.12, PyJWT 2.15.0 vs 2.13.0 and tzdata 2026.4 vs
2026.3 (five packages; the Python interpreter is also different). These are
validation gaps, not demonstrated dependency failures. The Docker executable was
unavailable, so an exact pinned Linux image build and full container startup
remain unverified. Live Redis/Celery/Telegram, browser end-to-end behavior, existing
production data migrations and production load were not tested by these checks.

Release requirements remain: include all new modules and the
`sync_engine/0002_syncoperation` migration in the deployment artifact; migrate
public and every active tenant before accepting the new sync writes; release
the frontend/backend together; recreate workers including `notification_worker`
and restart Beat. Inactive tenant schemas must be migrated before reactivation.
Do not clear IndexedDB/outbox data during the frontend update. Existing untracked
files in the working tree are not automatically included by a Git-based deployment.
No production deployment or production database writes were performed.

## Student, attendance and archive lifecycle (2026-11-09)

Attendance generation and bulk confirmation now populate student/group name
snapshots explicitly. Bulk inserts do not call the model's `save()` method.
Confirmation of existing drafts also fills previously missing snapshots.

Student archives, including the waiting-hall path, now capture exact related-row
IDs and enrollment timestamps/state. Restoration reconnects those IDs rather than
matching names, preserves original primary keys, and rejects an occupied identity.
Group archives additionally capture all invoices before deleting students,
custom schedules, special/canceled lessons, mentor assignments, homework and
submissions. Group restoration reuses the student restoration service, restores
invoice verification/refund details and reconnects attendance/test/ledger rows.
Restoring a student separately before its group does not duplicate invoices.
Each restore is atomic: a failure leaves the archives available and rolls back
the new rows. Historical restoration does not send welcome/homework notifications.

Dated membership validation is shared by generation, confirmation and individual
attendance edits. A stale primary-group FK, inactive enrollment or existing draft
cannot authorize attendance after leaving. Historical attendance remains editable
within the existing date permissions when membership covered that date. Invalid
bulk members reject the entire payload, including offline replay, before writes.

Student and group archive lists, detail/restore/delete and bulk actions now share
the admin's primary/explicitly allowed branch scope. Restoration services also
enforce scope. Super admins retain access to all branches. Legacy branch-name
fallbacks require an unambiguous existing branch; missing scope does not grant
tenant-wide admin access.

Compatibility: existing metadata remains readable and legacy invoices can be
restored. Old archives without related-row IDs cannot reliably identify orphaned
attendance, particularly blank snapshots or students sharing a name. These rows
are left untouched, with API warnings and server logs, instead of being assigned
to a guessed owner. Already lost historical ownership requires reconciliation
against a trusted backup or an explicit verified mapping. This change does not
claim to reconstruct that missing information automatically.

Deployment requires the updated backend; this change adds no database migration
or frontend payload change. No production data was modified during verification.
Lifecycle regression tests are in `archivebase.tests_lifecycle`; run them with
`python manage.py test archivebase.tests_lifecycle --settings=config.test_settings --noinput`.
SQLite validates these behaviors locally; the configured isolated PostgreSQL
audit port was unavailable, so PostgreSQL row-lock behavior was not exercised.
Final local verification: 215 tests discovered, 211 passed and four
PostgreSQL-only tests skipped, including 19 passing lifecycle regressions.
Migration drift, Python compilation and diff whitespace checks passed.

## Runtime resilience follow-up (2026-11-07)

The follow-up audit found resource-exhaustion paths even though ordinary Django
exceptions already terminate only their own request. These changes bound those
paths and make unexpected API failures traceable.

| Finding | Change |
| --- | --- |
| Parallel image decoding/OCR can occupy every HTTP thread and multiply memory use. | One image pipeline per web process. Additional image requests return HTTP 503 with `Retry-After: 2`; the slot is released in `finally`, including decoder errors. The existing OCR subprocess timeout remains 25 seconds. With two Gunicorn workers this allows up to two simultaneous image pipelines, not a cluster-wide singleton. |
| Redis may become unavailable after the startup availability probe. | Cache connection/read socket timeouts are one second. Rate-limiter cache failure continues through the existing fallback. Redis client retries may add to the total; socket timeout is not an end-to-end HTTP deadline. |
| Telegram `retry_after` could put a worker to sleep for hours. | Delays above five seconds return the 429 response immediately. Single-message Celery tasks schedule their next attempt using the supplied delay (capped at one day), without occupying a worker during the delay. Short in-process waits and attempt counts remain bounded. |
| Unhandled API/database exceptions produce inconsistent responses. | The DRF exception handler preserves normal 4xx errors, returns generic 500 for unexpected failures and 503 for uncaught database availability errors, and includes an error ID linked to the server traceback. Transaction rollback is marked where request-level atomic transactions apply; explicit atomic blocks still govern business writes. |
| An HTTP SQL query/row lock could wait indefinitely. | Docker's web entrypoint enables PostgreSQL statement timeout (60 seconds) and lock timeout (5 seconds) after deployment migrations. This is a per-query deadline, not a total request deadline. |
| Celery jobs and child memory growth had no lifecycle bounds. | Soft/hard task limits default to 900/960 seconds; prefetch is one. Children recycle after 100 tasks or after a completed task exceeds 256 MiB. Recycling is not an in-flight memory cap. Startup broker reconnection is enabled. |
| Production error files/container stdout could grow without limit. | Django logs go to stderr; all nine Compose services use Docker rotation at 10 MiB × 3 files per container. Existing old log files are not deleted. |
| Upload bodies could remain in memory up to 10 MiB each; startup DB wait had no end. | Uploads larger than 1 MiB spool to temporary disk. Existing accepted-file limits remain. The entrypoint DB readiness loop stops after 120 bounded connection attempts. |

Deployment: rebuild/recreate web and Celery containers to load code, database
deadlines, task settings and Docker log rotation. A plain restart does not apply
changed Compose logging configuration. No deployment was performed during this
audit. Non-Docker web services must explicitly set `WEB_DATABASE_TIMEOUTS=1`;
leave it unset for deployment migration commands. Tune
`WEB_DB_STATEMENT_TIMEOUT_MS`, `WEB_DB_LOCK_TIMEOUT_MS`,
`CELERY_TASK_SOFT_TIME_LIMIT`, and `CELERY_TASK_TIME_LIMIT` to measured workloads.
Very large notifications/reports can hit the task deadline and require operational
review; these limits do not add resumable checkpoints or guaranteed delivery.

Gunicorn's existing `gthread --timeout 120` monitors worker responsiveness; it
does not forcibly cancel every long-running request. The SQL/OCR/network bounds
above address specific blocking paths. They cannot guarantee survival of arbitrary
CPU loops, an OS-level OOM kill, disk exhaustion from uploaded media, or host
failure. Production capacity/load testing and monitoring remain necessary.

Failure-injection tests in `config.tests_resilience` verify rollback after an
unexpected error, a successful following request, generic database-outage
responses, cache outages, concurrent OCR rejection and slot recovery, and bounded
or deferred Telegram waits. Full SQLite tests, Python compilation, migration drift
and Compose YAML parsing are checked locally. Docker runtime, real Redis outages,
PostgreSQL query cancellation, Celery process termination, and production load
are not exercised by the local SQLite tests.

Final follow-up result: 196 tests discovered, 192 passed, four PostgreSQL-only
tests skipped. Migration drift check reported no changes; Python compilation,
entrypoint shell syntax, Compose YAML/logging configuration, and diff whitespace
checks passed. The Docker executable was unavailable, so container startup was
not validated locally.

This release addresses the fourteen findings from the backend audit. It also closes anonymous attendance access found while following the affected mutation paths.

## Changes

| Area | Result |
| --- | --- |
| User roles | Only a tenant super admin can change roles. Mentors cannot move their own branch or edit another account. Admins cannot edit other admin accounts. |
| Offline authorization | Finance writes require an admin role and access to the target branch. Attendance and homework mutations require access to the group. Attendance dates, membership and payloads are validated. Lead reads and writes are scoped to their assigned employee, with a super admin override. |
| Mutation retries | `SyncOperation` persists the committed result, payload fingerprint and actor. `(client_id, queue_id)` is unique inside the tenant schema. A retry cannot charge again, change its payload or switch actors. Receipts survive actor deletion. |
| Sync failures | Each mutation has its own transaction. Failed mutations return an error and are never included in `applied_queue_ids`. Valid siblings can commit independently. Failed client records are retained until explicitly resolved. |
| Client identity | An IndexedDB transaction creates a persistent client UUID alongside the offline outbox. Logout does not reset the identity. Pushes are limited to 100 items, with bounded sequential batches. |
| Payments | Negotiated payments initialize all calculation flags. Confirmation locks the payment row before calculation and rolls all changes back on failure. PostgreSQL locks only the payment table, avoiding nullable-join locking errors. |
| Expenses | Offline expenses validate positive amounts and branch access, and attribute `marked_by` correctly. |
| Reports | Daily export applies branch scope before querying. Homework and submission status are SQL annotations rather than queries per attendance. Row styling no longer scans the growing worksheet for each row. Daily HTTP export uses write-only Excel generation and a spooled file response. |
| Financial totals | Monthly branch totals use verified, completed ledger cash entries, including partial receipts. Debt sums positive remaining invoice balances. Three grouped queries replace queries per branch. Both monthly report implementations share this calculation. |
| Student serialization | Enrollment, payment, attendance and financial data load in batches. Frozen fields reuse the same enrollment data. Group representations are reused within a response. |
| Telegram | Network sends use a dedicated Celery queue and bounded worker concurrency. Tenant schema and bot token are captured before dispatch. Homework and attendance workers require an explicit schema. Daemon-thread fallbacks were removed. |
| JWT | Token blacklist is installed; rotated refresh tokens cannot be reused. A nightly task removes expired outstanding/blacklisted tokens in public and active tenant schemas. |
| Branch access | PATCH fills omitted fields from the instance, excludes itself from duplicate checks, validates target users and retains admin transfer restrictions. |
| Migrations | Tenant app discovery uses Django app labels, including dotted blacklist configuration. Failed tenant migrations now fail the deployment command instead of being silently ignored. |

## Deployment

Deploy the backend, frontend and worker configuration as one release. Do not send the new sync format to a backend that has not been migrated.

```sh
cd backend
python manage.py migrate --noinput
python manage.py migrate_all_tenants --skip-public
```

The Docker web entrypoint runs these commands and stops if any tenant migration fails. Inactive tenants must be migrated with `migrate_tenant_schema <schema_name>` before they are reactivated.

Start/restart the `notification_worker` service added in `docker-compose.yml`. A non-Docker deployment needs the equivalent worker:

```sh
celery -A config worker -Q notifications -l info --concurrency=1 --prefetch-multiplier=1
```

Keep the existing default/heavy-report worker and Celery Beat running. Restart Beat to load the expired-token cleanup schedule. The notification worker needs the same media storage as the application for homework attachments.

The updated frontend sends a required `client_id`. Old frontend builds receive a validation error and must reload/update their service worker. Preserve IndexedDB and pending/failed outbox entries during this update. Do not delete retry receipts while clients can still replay an operation. A receipt cannot retrospectively identify requests accepted before this release, so reconcile ambiguous pre-release financial retries before resubmitting them.

Monthly summary cash totals intentionally reflect verified ledger receipts; the student detail sheet also shows partial payments recorded against invoices. Pending cashier verification does not contribute to verified cash totals.

## Verification

Run isolated SQLite tests without connecting to the configured application database:

```sh
cd backend
python manage.py test --settings=config.test_settings --noinput
python manage.py makemigrations --check --dry-run --settings=config.test_settings
```

`config.test_postgres_settings` targets an isolated local PostgreSQL cluster at `127.0.0.1:55439`, user `audit_runner`, and creates/destroys only `test_education_backend_audit`:

```sh
python manage.py test --settings=config.test_postgres_settings --noinput
```

PostgreSQL-specific tests send simultaneous duplicate mutations, accept simultaneous independent installments, and migrate an actual temporary tenant schema to verify tenant-local receipts and blacklist tables. SQLite skips those three tests because it cannot validate PostgreSQL row locks or schemas.

Regression coverage also verifies role escalation rejection, branch boundaries, expense attribution, failed mutation rollback, changed-payload and changed-actor replay rejection, negotiated payments, refresh-token revocation, readable Excel downloads, report query budgets and constant student-list query counts when expanding from one to fifty students.

Build the frontend with `npm run build`. In the restricted Windows environment, Vite's default config bundler could not read parent directories; `npm.cmd run build -- --configLoader native` completed successfully.

These checks validate local code and database behavior. They do not measure production throughput or exercise live Telegram delivery.

Final local verification: all 131 tests passed on an isolated PostgreSQL 18 cluster, including concurrent financial writes and tenant migrations. Django checks and migration drift checks passed. The production frontend build passed using the native config loader.
