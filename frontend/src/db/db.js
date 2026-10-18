import Dexie from 'dexie';

/**
 * Offline-First CRM lokal IndexedDB ma'lumotlar bazasi.
 *
 * Versiya 2: To'liq Offline-First ta'lim platformasi:
 * - leads: Lidlar va arizalar
 * - groups: Guruhlar va dars jadvallari
 * - students: O'quvchilar profili
 * - attendance_drafts: Dars vaqtida o'qituvchi belgilayotgan davomat qoralamalari
 * - attendance_records: Tasdiqlangan va oflayn saqlangan davomat yozuvlari
 * - query_cache: TanStack Query server keshini oflayn saqlash
 * - sync_queue: Serverga yuborilishi kerak bo'lgan mutatsiyalar navbati (Outbox)
 * - sync_meta: Sinxronizatsiya metama'lumotlari
 */
export const db = new Dexie('EduPlatformCRM_v1');

// Sxema versiyasi 1 (eski o'rnatilgan brauzerlar bilan muvofiqlik uchun saqlanadi)
db.version(1).stores({
  leads: '&id, name, phone, status, updated_at, is_deleted, [is_deleted+updated_at]',
  sync_queue: '++queue_id, entity, action, created_at, status',
  sync_meta: '&key, value',
});

// Sxema versiyasi 2: Asosiy ta'lim modullari
db.version(2).stores({
  leads: '&id, name, phone, status, updated_at, is_deleted, [is_deleted+updated_at]',
  groups: '&id, name, mentor_id, branch_id, updated_at',
  students: '&id, full_name, phone, branch_id, [branch_id+is_active], updated_at',
  // group_id va date bo'yicha tezkor kalit: "12_2026-10-18"
  attendance_drafts: '&key, group_id, date, updated_at',
  attendance_records: '++local_id, [group_id+date+student_id], group_id, date, student_id, is_present, updated_at',
  query_cache: '&query_key, data, updated_at',
  sync_queue: '++queue_id, entity, action, created_at, status',
  sync_meta: '&key, value',
});

// Sxema versiyasi 3: students jadvalida group_id bo'yicha indeks qo'shildi
db.version(3).stores({
  students: '&id, full_name, phone, group_id, branch_id, [branch_id+is_active], updated_at',
});

// ==========================================
// YORDAMCHI: DB ochilganda xatolarni ushlab qolish
// ==========================================
db.on('blocked', () => {
  console.warn('[DB] Eski tab ochiq — yangi versiya bloklanmoqda. Barcha tablarni yoping.');
});

db.on('versionchange', () => {
  db.close();
  window.location.reload();
});

/**
 * Xavfsiz UUID generator
 */
export function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Storage Persistence (Android Chrome va Desktop brauzerlar uchun):
 * Brauzer xotira to'lganda IndexedDB'dagi oflayn navbatni o'chirib yubormasligi uchun
 * 'persistent' ruxsatini so'raydi.
 */
export async function requestPersistentStorage() {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        const granted = await navigator.storage.persist();
        console.log(`[Storage] Persistent storage granted: ${granted}`);
        return granted;
      }
      return true;
    } catch (e) {
      console.warn('[Storage] Persistence request failed:', e);
      return false;
    }
  }
  return false;
}

// ==========================================
// DAVOMAT (ATTENDANCE) OFFLAYN METODLARI
// ==========================================

/**
 * Davomat qoralamasini saqlash (Auto-save):
 * O'qituvchi ekranda har bir o'quvchini belgilagan zahoti lokal saqlanadi.
 * Sahifa yangilansa ham, tab yopilsa ham yo'qolmaydi!
 */
export async function saveAttendanceDraft(groupId, date, attendancesMap) {
  const key = `${groupId}_${date}`;
  await db.attendance_drafts.put({
    key,
    group_id: Number(groupId),
    date,
    attendances: attendancesMap,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Davomat qoralamasini olish
 */
export async function getAttendanceDraft(groupId, date) {
  const key = `${groupId}_${date}`;
  const record = await db.attendance_drafts.get(key);
  return record ? record.attendances : null;
}

/**
 * Davomat qoralamasini tozalash (tasdiqlangandan keyin)
 */
export async function clearAttendanceDraft(groupId, date) {
  const key = `${groupId}_${date}`;
  await db.attendance_drafts.delete(key);
}

/**
 * Davomatni oflayn tasdiqlash va Outbox navbatiga qo'yish:
 * 1. Lokal jadvalga yozadi
 * 2. sync_queue ga 'attendance' mutatsiyasini qo'shadi
 * 3. Qoralamani tozalaydi
 */
export async function queueAttendanceConfirm(groupId, date, attendancesList, markedByUser = null) {
  const now = new Date().toISOString();

  // Studentlar bo'yicha dublikatlarni tozalash (IntegrityError va xatoliklarni oldini olish)
  const uniqueMap = new Map();
  for (const item of attendancesList) {
    const sId = Number(item.student_id);
    if (sId && !uniqueMap.has(sId)) {
      uniqueMap.set(sId, {
        student_id: sId,
        is_present: Boolean(item.is_present),
      });
    }
  }
  const cleanList = Array.from(uniqueMap.values());

  await db.transaction('rw', [db.attendance_records, db.attendance_drafts, db.sync_queue, db.query_cache], async () => {
    // 1. Lokal attendance_records keshga yozish (avvalgi eski yozuvlarni tozalab, yangisini qo'yish)
    try {
      const existing = await db.attendance_records
        .where('group_id')
        .equals(Number(groupId))
        .filter((a) => a.date === date)
        .toArray();

      if (existing.length > 0) {
        const ids = existing.map((e) => e.local_id).filter(Boolean);
        if (ids.length > 0) {
          await db.attendance_records.bulkDelete(ids);
        }
      }
    } catch (e) {}

    const recordsToStore = cleanList.map((item) => ({
      group_id: Number(groupId),
      date,
      student_id: item.student_id,
      is_present: item.is_present,
      marked_by: markedByUser || { id: 1, full_name: 'Men' },
      updated_at: now,
    }));

    for (const rec of recordsToStore) {
      await db.attendance_records.add(rec);
    }

    // 2. db.query_cache ni ham yangilab qo'yamiz (offline qidiruvlar darhol ko'rishi uchun)
    await db.query_cache.put({
      query_key: `attendance_${groupId}_${date}`,
      data: recordsToStore,
      updated_at: now,
    });

    // 3. Outbox navbatiga qo'shish (agar avval pending bo'lsa, yangisiga almashtirish)
    try {
      const existingPending = await db.sync_queue
        .where('status')
        .equals('pending')
        .filter((q) => q.entity === 'attendance' && Number(q.data?.group_id) === Number(groupId) && q.data?.date === date)
        .toArray();

      if (existingPending.length > 0) {
        await db.sync_queue.bulkDelete(existingPending.map((p) => p.queue_id));
      }
    } catch (e) {}

    await db.sync_queue.add({
      action: 'confirm',
      entity: 'attendance',
      data: {
        group_id: Number(groupId),
        date,
        attendances: cleanList,
      },
      created_at: now,
      status: 'pending',
    });

    // 4. Qoralamani o'chirish
    await db.attendance_drafts.delete(`${groupId}_${date}`);
  });

  return { success: true, queued: true };
}

// ==========================================
// USER AUTH & PERMISSIONS OFFLINE KESH
// ==========================================

export async function cacheUserMe(userData) {
  try {
    if (!userData || !userData.id) return;
    localStorage.setItem('cached_user_me', JSON.stringify(userData));
    await db.query_cache.put({
      query_key: 'user-me',
      data: userData,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {}
}

export async function getCachedUserMe() {
  try {
    const fromStorage = localStorage.getItem('cached_user_me');
    if (fromStorage) {
      return JSON.parse(fromStorage);
    }
    const rec = await db.query_cache.get('user-me');
    return rec?.data || null;
  } catch (e) {
    return null;
  }
}

// ==========================================
// TANSTACK QUERY KESH METODLARI (OFFLINE READS)
// ==========================================

export async function cacheQuery(queryKey, data) {
  try {
    const key = Array.isArray(queryKey) ? queryKey.join('/') : String(queryKey);
    await db.query_cache.put({
      query_key: key,
      data,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    // Kesh xatosi asosiy oqimni to'xtatmasin
    console.warn('[QueryCache] Put failed:', e);
  }
}

export async function getCachedQuery(queryKey) {
  try {
    const key = Array.isArray(queryKey) ? queryKey.join('/') : String(queryKey);
    const rec = await db.query_cache.get(key);
    return rec ? rec.data : undefined;
  } catch (e) {
    console.warn('[QueryCache] Get failed:', e);
    return undefined;
  }
}

// ==========================================
// LIDLAR (LEADS) METODLARI
// ==========================================

export async function createLocalLead(leadData) {
  const newLead = {
    id: leadData.id || generateUUID(),
    name: leadData.name,
    phone: leadData.phone,
    email: leadData.email || '',
    status: leadData.status || 'new',
    notes: leadData.notes || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_deleted: false,
    ...leadData,
  };

  await db.transaction('rw', [db.leads, db.sync_queue], async () => {
    await db.leads.put(newLead);
    await db.sync_queue.add({
      action: 'create',
      entity: 'leads',
      data: newLead,
      created_at: new Date().toISOString(),
      status: 'pending',
    });
  });

  return newLead;
}

export async function updateLocalLead(id, changes) {
  const existing = await db.leads.get(id);
  if (!existing) throw new Error(`Lid topilmadi: ${id}`);

  const updatedData = {
    ...existing,
    ...changes,
    updated_at: new Date().toISOString(),
  };

  await db.transaction('rw', [db.leads, db.sync_queue], async () => {
    await db.leads.put(updatedData);
    await db.sync_queue.add({
      action: 'update',
      entity: 'leads',
      data: updatedData,
      created_at: new Date().toISOString(),
      status: 'pending',
    });
  });

  return updatedData;
}

export async function deleteLocalLead(id) {
  const existing = await db.leads.get(id);
  if (!existing) return;

  const deletedLead = {
    ...existing,
    is_deleted: true,
    updated_at: new Date().toISOString(),
  };

  await db.transaction('rw', [db.leads, db.sync_queue], async () => {
    await db.leads.put(deletedLead);
    await db.sync_queue.add({
      action: 'delete',
      entity: 'leads',
      data: { id, is_deleted: true, updated_at: deletedLead.updated_at },
      created_at: new Date().toISOString(),
      status: 'pending',
    });
  });
}
