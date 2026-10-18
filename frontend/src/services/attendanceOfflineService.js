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

      // IndexedDB ga atomik tarzda yozish
      await db.transaction('rw', [db.groups, db.students, db.attendance_records, db.query_cache, db.sync_meta], async () => {
        for (const item of bundle) {
          const groupId = Number(item.group_id);

          // 1. Guruh ma'lumotlarini saqlash
          if (item.group_detail) {
            const bId = item.group_detail.branch?.id || item.group_detail.branch_id;
            await db.groups.put({
              ...item.group_detail,
              id: groupId,
              branch_id: bId ? Number(bId) : undefined,
              updated_at: nowIso,
            });

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

        // 6. O'quvchilarning kalendardagi 1 oylik davomat matritsasini saqlash
        if (student_monthly_attendances && student_monthly_attendances.length > 0) {
          for (const monthly of student_monthly_attendances) {
            if (!monthly || !monthly.student_id) continue;
            const studentId = Number(monthly.student_id);
            const mYear = monthly.year || current_year;
            const mMonth = monthly.month || current_month;

            await db.query_cache.put({
              query_key: `student-monthly_${studentId}_${mYear}_${mMonth}_all`,
              data: monthly,
              updated_at: nowIso,
            });

            await db.query_cache.put({
              query_key: `student-monthly_${studentId}_${mYear}_${mMonth}`,
              data: monthly,
              updated_at: nowIso,
            });

            if (this.queryClient) {
              this.queryClient.setQueryData(['student-monthly-attendance', String(studentId), mYear, mMonth, ''], monthly);
              this.queryClient.setQueryData(['student-monthly-attendance', Number(studentId), mYear, mMonth, ''], monthly);
              this.queryClient.setQueryData(['student-monthly-attendance', String(studentId), mYear, mMonth, undefined], monthly);
              this.queryClient.setQueryData(['student-monthly-attendance', Number(studentId), mYear, mMonth, undefined], monthly);
            }
          }
        }

        // Oxirgi yuklab olingan vaqtni saqlash
        await db.sync_meta.put({
          key: 'last_attendance_prefetched_at',
          value: nowIso,
        });
      });

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

    // 2. Internet tiklanganda avtomatik yangilash
    window.addEventListener('online', () => {
      setTimeout(() => {
        if (localStorage.getItem('access_token')) {
          this.prefetchBundle();
        }
      }, 3000);
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
