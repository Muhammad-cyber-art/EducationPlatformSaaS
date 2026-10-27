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
    // 0. Agar login sahifasida bo'lsa — prefetch qilmaslik (serverni zo'riqtirmaslik va 504 oldini olish)
    if (typeof window !== 'undefined' && window.location.pathname.includes('/login')) {
      return { success: false, reason: 'on_login_page' };
    }

    // 1. Agar foydalanuvchi tizimga kirmagan bo'lsa (token yo'q) — to'xtatish
    if (typeof localStorage === 'undefined' || !localStorage.getItem('access_token')) {
      return { success: false, reason: 'unauthenticated' };
    }

    // 2. Agar internet yo'q bo'lsa — to'xtatish
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { success: false, reason: 'offline' };
    }

    // 3. Agar hozir yuklanayotgan bo'lsa va force bo'lmasa — qayta chaqirmaslik
    if (this.isPrefetching && !force) {
      return { success: false, reason: 'already_running' };
    }

    this.isPrefetching = true;
    this.notify('prefetch_start', { timestamp: new Date().toISOString() });

    try {
      const response = await api.get('/groups/groups/offline-attendance-bundle/', { timeout: 20000 });
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

      // DB ochiqligini kafolatlash
      if (!db.isOpen()) {
        try {
          await db.open();
        } catch (openErr) {
          console.warn('[AttendanceOfflineService] db.open warning:', openErr);
        }
      }

      const saveAllBundleData = async () => {
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
              // BUG FIX: Eskirgan/avvalgi prefetch yozuvlarini o'chirib, toza yozish.
              // Aks holda har 15 daqiqada local_id siz yangi dublikatlar qo'shilib,
              // IndexedDB to'lib ketadi va brauzer xotirasi to'ladi (QuotaExceededError)!
              try {
                const oldRecs = await db.attendance_records
                  .where('group_id')
                  .equals(groupId)
                  .filter((a) => a.date === current_date)
                  .toArray();
                if (oldRecs.length > 0) {
                  const oldIds = oldRecs.map((r) => r.local_id).filter(Boolean);
                  if (oldIds.length > 0) {
                    await db.attendance_records.bulkDelete(oldIds);
                  }
                }
              } catch (_) {}

              const mappedAtts = todayAtts.map((a) => ({
                ...a,
                group_id: groupId,
                date: a.date || current_date,
                updated_at: nowIso,
              }));

              await db.attendance_records.bulkAdd(mappedAtts);
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
            let existingCached = null;
            try {
              existingCached = await db.query_cache.get(`nested_students_${studentId}`);
            } catch (_) {}

            const mergedProfile = {
              ...(existingCached?.data || {}),
              ...(existing || {}),
              ...profile,
              groups: (profile.groups && profile.groups.length > 0)
                ? profile.groups
                : (existingCached?.data?.groups || existing?.groups || []),
              group: profile.group || existingCached?.data?.group || existing?.group || null,
              joined_at: profile.joined_at || existingCached?.data?.joined_at || existing?.joined_at || null,
              parent_name: profile.parent_name || existingCached?.data?.parent_name || existing?.parent_name || "",
              parent_phone: profile.parent_phone || existingCached?.data?.parent_phone || existing?.parent_phone || "",
              notes: profile.notes || existingCached?.data?.notes || existing?.notes || "",
            };

            await db.students.put({
              ...(existing || {}),
              ...mergedProfile,
              id: studentId,
              updated_at: nowIso,
            });

            await db.query_cache.put({
              query_key: `nested_students_${studentId}`,
              data: mergedProfile,
              updated_at: nowIso,
            });

            if (this.queryClient) {
              const safeUpdate = (prev) => {
                if (!prev) return mergedProfile;
                return {
                  ...mergedProfile,
                  ...prev,
                  groups: (prev.groups && Array.isArray(prev.groups) && prev.groups.length > 0)
                    ? prev.groups
                    : mergedProfile.groups,
                  group: prev.group || mergedProfile.group,
                };
              };
              this.queryClient.setQueryData(['student', String(studentId)], safeUpdate);
              this.queryClient.setQueryData(['student', Number(studentId)], safeUpdate);
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
      };

      // IndexedDB ga xavfsiz yozish: tranzaksiya bilan yoki to'g'ridan-to'g'ri (fallback)
      try {
        await db.transaction('rw', [db.groups, db.students, db.attendance_records, db.query_cache, db.sync_meta, db.sync_queue], async () => {
          await saveAllBundleData();
        });
      } catch (txErr) {
        console.warn('[AttendanceOfflineService] Transaction write error, falling back to direct puts:', txErr?.message);
        try {
          await saveAllBundleData();
        } catch (fbErr) {
          console.warn('[AttendanceOfflineService] Direct save fallback error:', fbErr?.message);
        }
      }

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

      // 5. Kassa va to'lov ma'lumotlarini (Cashier Desk) lokal keshga olish
      try {
        const { get_user_info } = await import('../components/Authorized/getRole');
        const userInfo = get_user_info();
        const storedBranch = localStorage.getItem('active_branch_id') || localStorage.getItem('branch_id') || userInfo?.branch_id;
        const branchIds = new Set();
        if (storedBranch) branchIds.add(String(storedBranch));
        if (userInfo?.branch_id) branchIds.add(String(userInfo.branch_id));
        if (Array.isArray(userInfo?.accessible_branches)) {
          userInfo.accessible_branches.forEach((b) => {
            if (b.branch_id) branchIds.add(String(b.branch_id));
          });
        }

        const now = new Date();
        const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        for (const bId of branchIds) {
          try {
            const cashRes = await api.get('/finance/student-payments/cashier-desk/', {
              params: { branch_id: bId, month: curMonth },
              timeout: 8000,
            });
            if (cashRes.data) {
              await db.query_cache.put({
                query_key: `cashier-desk_${bId}_${curMonth}`,
                data: cashRes.data,
                updated_at: nowIso,
              });
              if (this.queryClient) {
                this.queryClient.setQueryData(['cashier-desk', Number(bId), curMonth], cashRes.data);
                this.queryClient.setQueryData(['cashier-desk', String(bId), curMonth], cashRes.data);
              }
            }
          } catch (_) {}
        }
      } catch (cashErr) {
        console.warn('[AttendanceOfflineService] Cashier prefetch skipped:', cashErr?.message);
      }

      // 6. User profile va ruxsatlarini oflayn keshga olish
      try {
        const userRes = await api.get('/user/me/', { timeout: 5000 });
        if (userRes.data) {
          const { cacheUserMe } = await import('../db/db');
          await cacheUserMe(userRes.data);
          if (this.queryClient) {
            this.queryClient.setQueryData(['user-me'], userRes.data);
          }
        }
      } catch (_) {}

      this.lastPrefetchedAt = nowIso;
      const studentsCount = response.data?.students_count || (student_profiles ? student_profiles.length : 0);
      try {
        localStorage.setItem(
          'local_db_status',
          JSON.stringify({
            synced_at: nowIso,
            groups_count: groups_count || bundle.length,
            students_count: studentsCount,
            has_finance: true,
          })
        );
      } catch (_) {}

      this.notify('prefetch_complete', {
        count: groups_count || bundle.length,
        studentsCount,
        timestamp: nowIso,
      });
      return { success: true, count: groups_count || bundle.length, studentsCount };
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

    if (typeof window === 'undefined' || this.initialized) return;
    this.initialized = true;

    // 1. Dastlabki yuklash (sahifa render bo'lib, dastlabki dashboard so'rovlari tinchishi uchun 6 soniya kutib)
    setTimeout(() => {
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login') && navigator.onLine && localStorage.getItem('access_token')) {
        this.prefetchBundle();
      }
    }, 6000);

    // 2. Internet tiklanganda avtomatik yangilash
    //    BUG FIX: 10 soniya kutib — syncService (1.5s) va financeService (4s) tugatganidan keyin
    //    ketma-ket (sequential) ishlashi uchun. Parallel og'ir so'rovlar sekin tarmoqda timeout qiladi.
    this._onlineHandler = () => {
      setTimeout(() => {
        if (localStorage.getItem('access_token')) {
          this.prefetchBundle();
        }
      }, 10000);
    };
    window.addEventListener('online', this._onlineHandler);

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
    if (this._onlineHandler && typeof window !== 'undefined') {
      window.removeEventListener('online', this._onlineHandler);
      this._onlineHandler = null;
    }
    this.listeners.clear();
    this.initialized = false;
  }
}

export const attendanceOfflineService = new AttendanceOfflineService();
