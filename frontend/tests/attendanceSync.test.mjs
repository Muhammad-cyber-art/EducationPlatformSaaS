import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { editableAttendanceStudents, sameAttendanceRoster, offlineAttendanceRoster } from '../src/utils/attendanceRoster.js';
import { isGroupLessonDate } from '../src/utils/scheduleUtils.js';
import { QueryClient } from '@tanstack/react-query';
import { invalidateEnrollmentQueries } from '../src/utils/enrollmentQueries.js';

const source = await readFile(new URL('../src/services/syncService.js', import.meta.url), 'utf8');

test('adding a student invalidates fresh ten-minute group and dated-roster caches', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  const group = ['group-students', '7'];
  const roster = ['attendance-roster', '7', '2026-11-12'];
  client.setQueryData(group, [{ id: 1 }]);
  client.setQueryData(roster, [{ id: 1, can_mark: true }]);
  client.setQueryData(['user-me'], { id: 3 });
  assert.equal(client.getQueryState(group).isInvalidated, false);
  await invalidateEnrollmentQueries(client);
  assert.equal(client.getQueryState(group).isInvalidated, true);
  assert.equal(client.getQueryState(roster).isInvalidated, true);
  assert.equal(client.getQueryState(['user-me']).isInvalidated, false);
  client.clear();
});

test('only the configured weekdays enable attendance', () => {
  const group = { custom_days: [0, 2, 4] };
  assert.equal(isGroupLessonDate('2026-11-13', group), true);
  assert.equal(isGroupLessonDate('2026-11-15', group), false);
});

test('an old editable-date list cannot enable a day after rescheduling', () => {
  assert.equal(isGroupLessonDate('2026-11-13', {
    custom_days: [1, 3, 5], last_3_lesson_dates: ['2026-11-13'],
  }), false);
});

test('extra lessons enable a day but cancellation takes precedence', () => {
  const group = { custom_days: [1, 3, 5], special_lesson_dates: ['2026-11-13'] };
  assert.equal(isGroupLessonDate('2026-11-13', group), true);
  assert.equal(isGroupLessonDate('2026-11-13', { ...group, canceled_lesson_dates: ['2026-11-13'] }), false);
});

test('invalid dates and dates before the group starts cannot enable attendance', () => {
  const group = { custom_days: [0, 1, 2, 3, 4, 5, 6], start_date: '2026-11-20' };
  assert.equal(isGroupLessonDate('2026-11-13', group), false);
  assert.equal(isGroupLessonDate('2026-02-30', { custom_days: [0, 1, 2, 3, 4, 5, 6] }), false);
  assert.equal(isGroupLessonDate('', group), false);
});
const attendance = (id, present = true) => ({ queue_id: id, status: 'pending', entity: 'attendance', action: 'confirm',
  created_at: `2026-11-12T10:00:${String(id).padStart(2, '0')}Z`,
  data: { group_id: 7, date: '2026-11-12', attendances: [{ student_id: 1, is_present: present }] } });

test('read-only historical records are never included in confirmation', () => {
  assert.deepEqual(editableAttendanceStudents([{ id: 1, can_mark: true }, { id: 2, can_mark: false }]).map(row => row.id), [1]);
});

test('a transfer or newly joined member changes the roster and requires review', () => {
  assert.equal(sameAttendanceRoster([{ id: 1 }], [{ id: 1 }, { id: 2 }]), false);
  assert.equal(sameAttendanceRoster([{ id: 1 }, { id: 2 }], [{ id: 1 }, { id: 2, can_mark: false }]), false);
  assert.equal(sameAttendanceRoster([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 1 }]), true);
});

test('offline fallback excludes later joins and departed memberships', () => {
  const rows = offlineAttendanceRoster([
    { id: 1, joined_at: '2026-11-01T12:00:00+05:00' },
    { id: 2, joined_at: '2026-11-12T12:00:00+05:00' },
    { id: 3, joined_at: '2026-11-01T12:00:00+05:00', left_at: '2026-11-08T12:00:00+05:00' },
  ], '2026-11-10');
  assert.deepEqual(editableAttendanceStudents(rows).map(row => row.id), [1]);
});

test('a later freeze does not exclude a valid earlier offline date', () => {
  const rows = offlineAttendanceRoster([{ id: 1, is_frozen: true, frozen_at: '2026-11-12T12:00:00+05:00' }], '2026-11-10');
  assert.equal(rows[0].can_mark, true);
  assert.equal(rows[0].is_frozen, false);
});

async function harness(initial, reply) {
  const rows = new Map(initial.map(row => [row.queue_id, structuredClone(row)]));
  const meta = new Map();
  const calls = [];
  let active = 0;
  let maximum = 0;
  const collection = predicates => ({
    equals(value) { return collection([...predicates, row => row.status === value]); },
    filter(predicate) { return collection([...predicates, predicate]); },
    limit(limit) { return { sortBy: async field => (await this.sortBy(field)).slice(0, limit) }; },
    async sortBy(field) { return [...rows.values()].filter(row => predicates.every(predicate => predicate(row)))
      .sort((a, b) => a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0).map(row => structuredClone(row)); },
  });
  const db = {
    sync_queue: {
      where: () => collection([]), get: async key => rows.has(key) ? structuredClone(rows.get(key)) : undefined,
      update: async (key, update) => { if (rows.has(key)) Object.assign(rows.get(key), update); },
      bulkDelete: async keys => { keys.forEach(key => rows.delete(key)); },
    },
    sync_meta: { get: async key => meta.get(key), put: async value => { meta.set(value.key, value); } },
    transaction: async (...args) => args.at(-1)(),
  };
  const api = { async post(url, payload) {
    active += 1;
    maximum = Math.max(maximum, active);
    calls.push({ url, payload: structuredClone(payload) });
    try {
      return reply ? await reply(payload, calls.length) : {
        data: { applied_queue_ids: payload.mutations.map(item => item.queue_id) },
      };
    } finally { active -= 1; }
  } };
  const context = vm.createContext({ console, setTimeout, clearTimeout });
  const apiModule = new vm.SyntheticModule(['default'], function () { this.setExport('default', api); }, { context });
  const dbModule = new vm.SyntheticModule([
    'db', 'generateUUID', 'requestPersistentStorage', 'incrementSyncQueueRetry', 'runFullCleanup',
  ], function () {
    this.setExport('db', db);
    this.setExport('generateUUID', () => '11111111-1111-4111-8111-111111111111');
    this.setExport('requestPersistentStorage', async () => true);
    this.setExport('incrementSyncQueueRetry', async () => {});
    this.setExport('runFullCleanup', async () => {});
  }, { context });
  const module = new vm.SourceTextModule(source, { context, initializeImportMeta(meta) { meta.env = { DEV: false }; } });
  await module.link(specifier => specifier.includes('updater') ? apiModule : dbModule);
  await module.evaluate();
  return { service: module.namespace.syncService, rows, calls, maximum: () => maximum };
}

test('a timeout keeps the operation and retry uses the same client and queue identity', async () => {
  const h = await harness([attendance(1)], async (payload, attempt) => {
    if (attempt === 1) throw Object.assign(new Error('timeout'), { code: 'ECONNABORTED' });
    return { data: { applied_queue_ids: payload.mutations.map(item => item.queue_id) } };
  });
  await h.service.pushAttendance(1);
  assert.equal(h.rows.get(1).status, 'pending');
  await h.service.pushAttendance(1);
  assert.deepEqual(h.calls[0].payload, h.calls[1].payload);
  assert.equal(h.rows.size, 0);
});

test('acknowledging an older edit never deletes a newer edit for the same day', async () => {
  const h = await harness([attendance(1), attendance(2, false)]);
  await h.service.pushAttendance(1);
  assert.equal(h.rows.has(1), false);
  assert.equal(h.rows.get(2).data.attendances[0].is_present, false);
});

test('earlier unacknowledged attendance edits are sent before the target edit', async () => {
  const h = await harness([attendance(1), attendance(2, false)]);
  await h.service.pushAttendance(2);
  assert.deepEqual(h.calls[0].payload.mutations.map(item => item.queue_id), ['1', '2']);
  assert.equal(h.rows.size, 0);
});

test('background sync and immediate attendance submission cannot overlap', async () => {
  let release;
  let entered;
  const blocked = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  const h = await harness([attendance(1)], async (payload, attempt) => {
    if (attempt === 1) { entered(); await blocked; }
    return { data: { applied_queue_ids: payload.mutations.map(item => item.queue_id) } };
  });
  const background = h.service.pushChanges();
  await started;
  h.rows.set(2, attendance(2, false));
  const immediate = h.service.pushAttendance(2);
  release();
  await Promise.all([background, immediate]);
  assert.equal(h.maximum(), 1);
  assert.deepEqual(h.calls[1].payload.mutations.map(item => item.queue_id), ['2']);
});

test('server rejection is retained as failed with its reason', async () => {
  const h = await harness([attendance(1), attendance(2)], async () => ({ data: {
    applied_queue_ids: [], errors: [{ queue_id: '1', retryable: false, detail: 'Membership ended' }],
  } }));
  await h.service.pushAttendance(1);
  assert.equal(h.rows.get(1).status, 'failed');
  assert.equal(h.rows.get(1).last_error, 'Membership ended');
  assert.equal(h.rows.get(2).status, 'pending');
});

test('attendance confirmation does not wait behind unrelated queued finance writes', async () => {
  const h = await harness([{ ...attendance(1), entity: 'cashier_payment', action: 'pay' }, attendance(2)]);
  await h.service.pushAttendance(2);
  assert.deepEqual(h.calls[0].payload.mutations.map(item => item.entity), ['attendance']);
  assert.equal(h.rows.has(1), true);
});
