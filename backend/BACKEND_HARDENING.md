# Backend hardening

## Multiple-course membership fix (2026-11-12)

Joining an existing student to another group now preserves all other enrollments,
their dates, attendance and invoices. The legacy `Student.group` field is a
primary-group pointer: saving or clearing it no longer deletes memberships.
Partial saves that exclude this field cannot reactivate a stale membership.
Enrollment writes lock the student row; rejoining clears a stale `left_at`.
Explicit transfer still moves its selected source course, but leaves unrelated
courses intact. Removing one course preserves a student's other active courses,
including students without a phone number.

Nightly attendance creation now uses the same dated membership and freeze rules
as HTTP attendance reads, including legacy records without an enrollment. It
retains model save signals for finance and skips archived/inactive groups.
The `create_attendance` command uses the same tenant-aware generation path.

The old `cleanup_transferred_enrollments` command could delete legitimate second
courses, historical memberships and unpaid invoices. Mutation mode is disabled
and exits with `CommandError` before any writes. `--dry-run [--tenant SCHEMA]`
now provides only a read-only membership count, not proposed deletions. Remove
old scheduled invocations of this command and check production cron/deployment
scripts; the repository does not establish whether it was scheduled there.

Deploy the updated code to all backend processes together. With Compose:

```sh
docker compose up -d --build web celery_worker notification_worker celery_beat telegram_bot
```

No schema migration or frontend payload change is required. This fix prevents
further losses; it cannot recover already deleted enrollment dates or invoices.
Reconcile those against a trusted backup or an explicitly verified mapping of
student IDs, group IDs and membership dates. Do not infer current memberships
from old attendance, old transfers or the primary-group pointer alone.

Local verification: 227 tests discovered; 223 passed and four PostgreSQL-only
tests skipped using `config.test_settings`. The 12 new membership regressions
cover API joins/retries, next-day generation and HTTP reads, rejoining, legacy
memberships, partial saves, transfer/unenrollment isolation, generation rules,
finance save signals, the attendance command and disabled cleanup behavior.
Migration drift and diff whitespace checks passed. No production data was
modified and no deployment was performed. PostgreSQL row locking and live
Celery scheduling were not exercised by the SQLite run.

### Cashier and monthly billing follow-up (2026-11-12)

Cross-branch membership exposed an existing ledger attribution bug: receipts,
paid-invoice adjustments and group-specific extra payments preferred the
student's primary branch over the selected group's branch. These paths now
prefer the group's branch, matching cashier authorization and refunds. The
primary branch remains a fallback for payments whose group no longer exists.
Existing ledger entries are not rewritten; historical misattribution needs
separate reconciliation.

Five additional regressions verify independent 300,000/500,000 course invoices,
repeat monthly generation without duplicate bills or cash entries, a 100,000
installment reducing only its selected course's debt, and branch attribution
for cashier receipts, adjustments and extra payments. Full isolated SQLite
result: 232 discovered, 228 passed, four PostgreSQL-only tests skipped.
Migration drift and diff whitespace checks passed. Production was not modified.

### Admin cashier approval indicators (2026-11-12)

Cashier roster/debtor rows, group cards in the student drawer and completed
student-fee receipts now distinguish payment collection from super-admin
approval. Green means approved; amber means approval is pending. Offline queued
payments use a blue awaiting-upload badge. Old cached payloads without approval
fields show an unknown state rather than a guessed approval. The roster refreshes
every 30 seconds while active; offline badges reflect locally cached state.

Cashier desk/offline bundle and student detail responses include `is_verified`
and `verification_status` per invoice. A correlated pending-receipt check avoids
per-student roster queries and overrides stale legacy invoice approval flags.
New installments reset invoice approval metadata while preserving previously
approved ledger receipts; the verify action can also approve pending receipts
when a legacy invoice flag is already true. Payment amounts, debt settlement
and the super-admin-only approval restriction are preserved.

Deploy backend and frontend together; no migration is required. Six approval
regressions cover unpaid/partial/full receipts, reapproval after an installment,
drawer/roster agreement, admin rejection and stale legacy flags. Full isolated
SQLite result: 238 discovered, 234 passed, four PostgreSQL-only tests skipped.
Frontend production build passed; targeted ESLint returned zero errors and
10 existing warnings. Migration drift and diff whitespace checks passed.
Browser visual QA, PostgreSQL locking and production deployment were not run.

### Cashier arithmetic explanations (2026-11-12)

The cashier student drawer now shows a per-course explanation with comparison
bars, a sequence of arithmetic operations, recorded payments, the final balance,
and a dated lesson calendar. Reduced balances have a "Nega bu summa?" shortcut
on roster/debtor rows. Switching courses uses that course's own calculation.

This is read-only: amounts reconcile to the invoice and cashier balance rather
than recalculating or changing debt. Individual prices, matching midmonth join
or group-start calculations, recorded attendance refunds, prior receipts and
grant coverage are separated. Rounding happens after multiplication. Confirmed
attendance, unmarked dates, canceled/special lessons and membership dates are
shown separately. Membership dates use the configured local timezone.

Current schedules and prices are not historical billing snapshots. Matching
schedule arithmetic is labeled as a current-data cross-check. An unexplained
historical difference is shown as a recorded difference with an explicit warning;
it is never fabricated as a discount. Invoice notes are shown when available.
No-invoice results are labeled as estimates. A saved zero amount is retained
instead of falling back to the full course price. Offline queued payments do
not display stale cached arithmetic until the server can confirm the amount.

Ten new regression cases cover arithmetic continuity, proration plus installments,
individual prices, refunds without double deduction, rounding, canceled/special
dates, grants, unknown historical differences, zero invoices, independent course
amounts and no-invoice estimates. Full isolated SQLite result: 248 discovered,
244 passed, four PostgreSQL-only tests skipped. Frontend production build passed;
targeted ESLint reported zero errors and two existing warnings. Browser QA could
not start because the Windows sandbox denied access to its helper directory.
No production data was changed and no deployment was performed.

### Current-month group tariff changes (2026-11-12)

Changing a group's `monthly_price` through normal model/API saves now updates
recognizable open current-month invoices in the same transaction. The group row
and invoice rows are locked. Fully settled invoices remain at their original
amount, as explicitly selected for this release. Receipts, paid amounts and
existing receipt approval metadata are not rewritten and no cash movement is
created by a tariff edit. A price decrease can settle an invoice whose existing
receipts already cover the new amount; it does not automatically refund cash.

Explicit individual fees remain fixed. Midmonth enrollment/group-start fractions
are retained when the existing invoice matches that basis. Recorded attendance
refunds scale with the applicable tariff; ignored refunds remain ignored.
Tariff-based grant invoices use the existing attendance calculation. Historical
months, existing future invoices, frozen/inactive memberships and other courses
are not repriced. Missing invoices are not created by this operation; ordinary
monthly generation uses the new tariff when it creates later invoices.

Ambiguous legacy/manual amounts are preserved and reported by student name in
`billing_update`, rather than treated as full-month bills without evidence.
This is not a retroactive repair of invoices already stale before this release.
Those require a verified pricing basis. Raw `QuerySet.update()`/SQL bypasses
model save behavior and must not be used to change tariffs when invoice
synchronization is required. Unpaid mentor salary recalculation remains part
of the transaction when student invoices change.

Group-edit responses include updated/preserved/review counts. The frontend shows
the result and invalidates cashier, group, membership and schedule queries so
the new figures are fetched immediately. No schema migration is required;
deploy all backend processes and the frontend together.

Verification: 14 new repricing regressions cover 400,000→450,000, installments,
paid/history/future preservation, individual fees, proration/refunds/grants,
unrecognized amounts, frozen/other-course isolation, partial model saves,
rollback after an invoice write, retries and tariff reductions. Full isolated
SQLite suite: 262 discovered, 258 passed, four PostgreSQL-only tests skipped.
Frontend production build passed; targeted lint had zero errors and four
existing warnings. Migration drift and diff whitespace checks passed. No
production changes or deployment were performed; PostgreSQL lock behavior was
not exercised locally.

### Attendance confirmation timeouts and retries (2026-11-12)

The reported Axios `ECONNABORTED` means no response arrived within the 25-second
client deadline; it does not prove that the attendance transaction failed.
Code inspection found repeated per-student mentor salary calculations and a
Celery result-consumer Redis subscription during notification publication.
Celery's result-backend reconnect policy can add waits despite publish retry
being disabled. Attendance notification tasks now explicitly ignore results,
avoiding that subscription. Broker connect/read limits remain in effect; the
global Axios timeout was not increased. The exact original runtime delay was
not profiled in the authenticated live application.

Bulk confirmation recalculates relevant student invoices, then mentor salary
once for the group/month. Regular students skip the unrelated finance loop.
Comparing marker IDs avoids fetching a user for every attendance row. Repeating
unchanged attendance does not republish notifications or recalculate finance.
Paid employee salaries are preserved. Recalculations taking at least two seconds
log group/date/student count and duration for further diagnosis. These changes
reduce known blocking work; they do not establish a hard request deadline.

Online attendance now submits its persisted outbox item through the same sync
endpoint/client/queue identity used by retries. Pushes in one browser session are
serialized; earlier pending edits of the same group/day precede a newer edit.
Only explicitly acknowledged queue IDs are removed. New edits never replace
the payload or identity of an older possibly committed operation. Outbox rows
remain available after a timeout, and permanent server rejection remains failed
with its reason. A failed IndexedDB transaction no longer produces optimistic
confirmation or a local-save success message. UI messages distinguish local
durability, pending server confirmation and actual server acknowledgment.

Deploy backend/web, notification workers and frontend together. No migration
or IndexedDB reset is required. Preserve existing client identity and queued
operations. An unavailable broker can still prevent Telegram dispatch; the
existing robust callback preserves committed attendance, but does not provide
a durable notification-delivery guarantee or a broker-outage replay queue.

Verification: full isolated SQLite suite discovered 270 tests; 266 passed and
four PostgreSQL-only tests skipped. Eight new backend regressions cover batching,
unchanged confirms, query count, publishing without a result subscription,
broker failure, grant invoices, paid salaries and lost-response replay. Six
frontend orchestration tests pass with `npm run test:sync` (Node VM modules and
mocked API/storage, not browser IndexedDB integration). Production build,
targeted lint (zero errors/two existing warnings), migration drift and diff
whitespace checks passed. Live authenticated request timing, real worker
delivery, multi-tab browser races and PostgreSQL locks were not exercised.

## Dated attendance rosters after transfer and restoration

`GET /api/homework_attends/attendances/roster/?group_id=ID&date=YYYY-MM-DD`
returns students eligible on that exact date plus existing historical rows.
Each row includes `can_mark`, current membership and current freeze flags.
The endpoint enforces the existing group/branch permissions. Historical records
without dated membership remain readable but cannot authorize new attendance.
Past members remain eligible within their actual membership dates even if they
have since left or frozen their membership. Existing date-edit permissions still
apply independently.

The frontend uses that dated roster in the table and confirmation payload. It
refreshes it before an online confirmation; if eligible members changed, it
updates the table and requests review before creating a new outbox operation.
Read-only rows are excluded from attendance confirmation. Former members cannot
be included in current membership management/bulk actions from a historical
roster. Freeze/transfer/restore refreshes reload both attendance and the roster.
Offline use prefers the cached dated snapshot and otherwise filters known local
membership dates; server validation remains authoritative when replayed.
Multiple pending edits display the latest local intent while retaining FIFO
submission and immutable operation identities.

The project's explicit transfer operation already relocates source attendance
history. It now carries the trusted source membership start into the target
enrollment and resumes the target's active/unfrozen state. Transfer calculations
use the configured local day. Archive restoration preserves original enrollment
timestamps; legacy primary-group archives with absent enrollment data or an
absent join timestamp use the retained original student join date. It does not
infer missing secondary-course membership dates or unfreeze archived history.

Invalid payloads still reject atomically. Structured errors identify the affected
date, student and membership reason rather than exposing Python `ErrorDetail`
representations. Names of unrelated students are not exposed through ID probing.
Existing failed outbox operations are retained for review, not silently dropped.
Already corrupted production dates are not guessed or bulk-rewritten; repair
requires a trusted backup or a verified student/group/date mapping.

Deploy backend and frontend together; no migration or storage reset is needed.
Verification: full isolated SQLite suite discovered 281 tests; 277 passed and
four PostgreSQL-only tests skipped. Eleven new backend regressions cover dated
rosters, transfer history, modern/legacy restores, frozen history, branch scope,
structured errors and atomic rejection. `npm run test:sync` passes all ten
frontend orchestration/helper tests. Production build and targeted lint passed
(zero errors, ten existing warnings); migration drift and whitespace checks
passed. Browser visual QA, PostgreSQL locking and production repair/deployment
were not performed.

## Disabled attendance controls on non-lesson days (2026-11-13)

Desktop/mobile attendance toggles and confirm/save controls now use native
`disabled` states with reduced opacity and an explanatory tooltip on non-lesson
or canceled dates. Extra lessons remain available on their explicitly added
dates. A shared frontend schedule predicate uses weekly days, group start date,
extra lessons and cancellations; cached monthly dates and the last-three-editable
dates no longer override the actual schedule. Handler and existing permission
checks remain in place. This change does not alter backend membership rules.

Four schedule regressions were added to `npm run test:sync`; all 14 frontend
tests pass. Targeted lint reported zero errors and seven existing warnings;
the production frontend build passed. No backend migration or production
deployment was performed. Browser visual QA was not performed.

## Newly added student visibility (2026-11-13)

The reported case was a successful student creation with no visible new row.
The new/existing-student add flows previously invalidated only group detail,
leaving the ten-minute group-student cache and dated attendance roster stale.
They now invalidate the relevant membership, roster, student and cashier query
families. The profile join modal also invalidates those caches, resets its
selection when opened, releases loading in `finally`, and displays server errors.

The dated roster now includes all current group members even when an earlier
attendance date is selected. A newly joined student is visible with the actual
join-date explanation and `can_mark=false` for earlier dates; attendance eligibility
is not broadened. Former/historical members retain the existing dated rules.
Rows without an invoice in the selected month do not show a debt badge merely
because they are current members viewed before joining. No student, invoice or
attendance is recreated by refreshing this roster.

Verification: an API integration regression creates a student, checks the active
group enrollment and group student list, verifies visibility/read-only state on
an earlier date, and verifies current-date eligibility without creating past
attendance. A real QueryClient regression verifies invalidation despite infinite
stale time. Full isolated SQLite suite: 282 discovered, 278 passed, four
PostgreSQL-only tests skipped. All 15 frontend tests and production build passed;
targeted lint reported zero errors and three existing warnings. Migration drift
and whitespace checks passed. Deploy backend and frontend together; no migration
or production-data recreation is required. Browser QA and deployment were not
performed.

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
