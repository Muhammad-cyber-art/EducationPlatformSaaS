import api from '../tokenUpdater/updater';
import { db } from '../db/db';

/**
 * AttendanceOfflineService:
 * Faqat davomat olishga daxldor bo'lgan ma'lumotlarni (faol guruhlar, o'quvchilar ro'yxati,
 * joriy oy dars sanalari va so'nggi davomat yozuvlari) orqa fonda oldindan yuklab olib,
 * Dexie IndexedDB va React Query keshiga joylaydi.
 * 
 * Natijada o'qituvchi yoki admin oflayn bo'lgan paytda istalgan guruhiga kirib,
 * internet yo'q bo'lsa ham barcha o'quvchilarni ko'rib, davomat ola oladi!
 */
class AttendanceOfflineService {
  constructor() {
    this.isPrefetching = false;
    this.intervalId = null;
    this.listeners = new Set();
    this.lastPrefetchedAt = null;
    this.queryClient = null;
  }

  setQueryClient(client) {
    this.queryClient = client;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(event, data) {
    this.listeners.forEach((cb) => {
      try {
        cb(event, data);
      } catch (e) {
        console.warn('[AttendanceOfflineService] listener error:', e);
      }
    });
  }

  /**
   * Backenddan faqat davomatga tegishli barcha guruhlar va o'quvchilar ro'yxatini yuklab olish
   */
  async prefetchBundle(force = false) {
    // 1. Agar foydalanuvchi tizimga kirmagan bo'lsa (token yo'q) — to'xtatish
    if (typeof localStorage === 'undefined' || !localStorage.getItem('access_token')) {
      return { success: false, reason: 'unauthenticated' };
    }

    // 2. Agar internet yo'q bo'lsa — to'xtatish
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { success: false, reason: 'offline' };
    }

    // 3. Agar hozir yuklanayotgan bo'lsa — qayta chaqirmaslik
    if (this.isPrefetching) {
      return { success: false, reason: 'already_running' };
    }

    this.isPrefetching = true;
    this.notify('prefetch_start', { timestamp: new Date().toISOString() });

    try {
      const response = await api.get('/groups/groups/offline-attendance-bundle/');
      const {
        bundle = [],
        student_profiles = [],
        student_monthly_attendances = [],
        current_date,
        current_month,
        current_year,
        groups_count = 0,
      } = response.data || {};

      if (!bundle || bundle.length === 0) {
        this.isPrefetching = false;
        this.notify('prefetch_complete', { count: 0 });
        return { success: true, count: 0 };
      }

      const nowIso = new Date().toISOString();
      // Guruhlarni branch_id bo'yicha guruhlab to'playmiz (keyinchalik groups-list cache uchun)
      const groupsByBranch = new Map(); // key: branch_id (Number), value: [group_detail, ...]

      // IndexedDB ga atomik tarzda yozish
      await db.transaction('rw', [db.groups, db.students, db.attendance_records, db.query_cache, db.sync_meta], async () => {
        for (const item of bundle) {
          const groupId = Number(item.group_id);

          // 1. Guruh ma'lumotlarini saqlash
          if (item.group_detail) {
            const bId = item.group_detail.branch?.id || item.group_detail.branch_id;
            const numBId = bId ? Number(bId) : null;
            await db.groups.put({
              ...item.group_detail,
              id: groupId,
              branch_id: numBId || undefined,
              updated_at: nowIso,
            });

            // Guruhni branch bo'yicha to'plash (groups-list cache uchun)
            if (numBId) {
              if (!groupsByBranch.has(numBId)) groupsByBranch.set(numBId, []);
              groupsByBranch.get(numBId).push(item.group_detail);
            }
            // branch_id null bo'lsa ham 0 key altida saqlaylik (super_admin uchun)
            if (!groupsByBranch.has(0)) groupsByBranch.set(0, []);
            groupsByBranch.get(0).push(item.group_detail);

            // React Query keshini to'ldirish
            await db.query_cache.put({
              query_key: `group-detail_${groupId}`,
              data: item.group_detail,
              updated_at: nowIso,
            });

            if (this.queryClient) {
              this.queryClient.setQueryData(['group-detail', String(groupId)], item.group_detail);
              this.queryClient.setQueryData(['group-detail', Number(groupId)], item.group_detail);
            }
          }

          // 2. Guruh o'quvchilarini saqlash
          if (item.students && item.students.length > 0) {
            const mappedStudents = item.students.map((st) => ({
              ...st,
              id: Number(st.id),
              group_id: groupId,
              updated_at: nowIso,
            }));

            await db.students.bulkPut(mappedStudents);

            await db.query_cache.put({
              query_key: `group-students_${groupId}`,
              data: item.students,
              updated_at: nowIso,
            });

            if (this.queryClient) {
              this.queryClient.setQueryData(['group-students', String(groupId)], item.students);
              this.queryClient.setQueryData(['group-students', Number(groupId)], item.students);
            }
          }

          // 3. Dars sanalarini saqlash
          if (item.lesson_dates) {
            await db.query_cache.put({
              query_key: `group-lesson-dates_${groupId}_${current_month}_${current_year}`,
              data: item.lesson_dates,
              updated_at: nowIso,
            });

            if (this.queryClient) {
              this.queryClient.setQueryData(['group-lesson-dates', String(groupId), current_month, current_year], item.lesson_dates);
              this.queryClient.setQueryData(['group-lesson-dates', Number(groupId), current_month, current_year], item.lesson_dates);
            }
          }

          // 4. Bugungi davomatni saqlash
          // MUHIM FIX (Vanishing Attendance himoyasi): Agar ushbu guruh va sana bo'yicha lokal
          // Outbox (sync_queue) da pending tasdiqlangan davomat bo'lsa, uni serverning eski holati bilan
          // aslo ustidan bosib (overwrite) yubormaymiz!
          const hasPendingQueue = await db.sync_queue
            .where('status')
            .equals('pending')
            .filter(
              (q) =>
                q.entity === 'attendance' &&
                Number(q.data?.group_id) === groupId &&
                q.data?.date === current_date
            )
            .count();

          if (!hasPendingQueue) {
            const todayAtts = item.today_attendances || [];
            if (todayAtts.length > 0) {
              const mappedAtts = todayAtts.map((a) => ({
                ...a,
                group_id: groupId,
                date: a.date || current_date,
                updated_at: nowIso,
              }));

              await db.attendance_records.bulkPut(mappedAtts);
            }

            await db.query_cache.put({
              query_key: `attendance_${groupId}_${current_date}`,
              data: todayAtts,
              updated_at: nowIso,
            });

            if (this.queryClient) {
              this.queryClient.setQueryData(['attendance', String(groupId), current_date], todayAtts);
              this.queryClient.setQueryData(['attendance', Number(groupId), current_date], todayAtts);
            }
          }
        }

        // 5. O'quvchilarning to'liq profillarini saqlash
        if (student_profiles && student_profiles.length > 0) {
          for (const profile of student_profiles) {
            if (!profile || !profile.id) continue;
            const studentId = Number(profile.id);

            const existing = await db.students.get(studentId);
            await db.students.put({
              ...(existing || {}),
              ...profile,
              id: studentId,
              updated_at: nowIso,
            });

            await db.query_cache.put({
              query_key: `nested_students_${studentId}`,
              data: profile,
              updated_at: nowIso,
            });

            if (this.queryClient) {
              this.queryClient.setQueryData(['student', String(studentId)], profile);
              this.queryClient.setQueryData(['student', Number(studentId)], profile);
            }
          }
        }

        // 6. O'quvchilarning kalendardagi 1 oylik davomat matritsasini saqlash (barcha guruhlar va alohida guruhlar)
        if (student_monthly_attendances && student_monthly_attendances.length > 0) {
          for (const monthly of student_monthly_attendances) {
            if (!monthly || !monthly.student_id) continue;
            const studentId = Number(monthly.student_id);
            const mYear = monthly.year || current_year;
            const mMonth = monthly.month || current_month;
            const grpKey = monthly.req_group_id ? String(monthly.req_group_id) : 'all';

            await db.query_cache.put({
              query_key: `student-monthly_${studentId}_${mYear}_${mMonth}_${grpKey}`,
              data: monthly,
              updated_at: nowIso,
            });

            if (grpKey === 'all') {
              await db.query_cache.put({
                query_key: `student-monthly_${studentId}_${mYear}_${mMonth}`,
                data: monthly,
                updated_at: nowIso,
              });
            }

            if (this.queryClient) {
              const qKey = grpKey === 'all' ? '' : grpKey;
              this.queryClient.setQueryData(['student-monthly-attendance', String(studentId), mYear, mMonth, qKey], monthly);
              this.queryClient.setQueryData(['student-monthly-attendance', Number(studentId), mYear, mMonth, qKey], monthly);
              if (grpKey === 'all') {
                this.queryClient.setQueryData(['student-monthly-attendance', String(studentId), mYear, mMonth, undefined], monthly);
                this.queryClient.setQueryData(['student-monthly-attendance', Number(studentId), mYear, mMonth, undefined], monthly);
              }
            }
          }
        }

        // Oxirgi yuklab olingan vaqtni saqlash
        await db.sync_meta.put({
          key: 'last_attendance_prefetched_at',
          value: nowIso,
        });
      });

      // Transaction tugagandan keyin guruhlar ro'yxatini TanStack Query cache ga joylash.
      // Bu — GroupsPage oflayn holatda guruhlarni ko'rsatishi uchun eng muhim qadam.
      if (this.queryClient && groupsByBranch.size > 0) {
        for (const [branchKey, groupsList] of groupsByBranch.entries()) {
          const paginatedData = {
            count: groupsList.length,
            next: null,
            previous: null,
            results: groupsList,
          };
          // branchKey===0 degani "filtrsiz" (super_admin yoki filial tanlanmagan)
          const bId = branchKey === 0 ? undefined : branchKey;
          // useInfiniteQuery format: {pages: [...], pageParams: [...]}
          const infiniteData = { pages: [paginatedData], pageParams: [1] };
          this.queryClient.setQueryData(['groups', bId, ''], infiniteData);
          this.queryClient.setQueryData(['groups', bId, undefined], infiniteData);
          this.queryClient.setQueryData(['groups', String(bId || ''), ''], infiniteData);
          // db.query_cache ga ham saqlaymiz (useGroupsData offline fallback uchun)
          try {
            await db.query_cache.put({
              query_key: `groups_list_${branchKey}`,
              data: groupsList,
              updated_at: nowIso,
            });
          } catch (_) {}
        }
      }

      this.lastPrefetchedAt = nowIso;
      this.notify('prefetch_complete', { count: groups_count, timestamp: nowIso });
      return { success: true, count: groups_count };
    } catch (error) {
      console.warn('[AttendanceOfflineService] prefetch error:', error?.message);
      this.notify('prefetch_error', { error: error?.message });
      return { success: false, error: error?.message };
    } finally {
      this.isPrefetching = false;
    }
  }

  /**
   * Background monitoring va intervalni ishga tushirish:
   * 1. Ilova ochilganda darhol (2 soniya kutib) birinchi yuklash
   * 2. Har 15 daqiqada orqa fonda yangilab turish
   * 3. Internet qayta ulangan zahoti (online event) yangilash
   */
  init(queryClient) {
    if (queryClient) {
      this.setQueryClient(queryClient);
    }

    if (typeof window === 'undefined') return;

    // 1. Dastlabki yuklash (token mavjud bo'lsa)
    setTimeout(() => {
      if (navigator.onLine && localStorage.getItem('access_token')) {
        this.prefetchBundle();
      }
    }, 2000);

    // 2. Internet tiklanganda avtomatik yangilash (syncService pending navbatni yuborib bo'lgach ishga tushadi)
    window.addEventListener('online', () => {
      setTimeout(() => {
        if (localStorage.getItem('access_token')) {
          this.prefetchBundle();
        }
      }, 6000);
    });

    // 3. Har 15 daqiqada yangilab borish
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.intervalId = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine && localStorage.getItem('access_token')) {
        this.prefetchBundle();
      }
    }, 15 * 60 * 1000);
  }

  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.listeners.clear();
  }
}

export const attendanceOfflineService = new AttendanceOfflineService();
