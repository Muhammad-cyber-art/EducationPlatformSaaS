import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from "../../../tokenUpdater/updater";
import toast from "react-hot-toast";
import { db } from '../../../db/db';

export const useHomeworkSubmission = () => {
 const { mission_id } = useParams();
 const navigate = useNavigate();
 const [homeworkData, setHomeworkData] = useState(null);
 const [loading, setLoading] = useState(true);
 const [deleteLoading, setDeleteLoading] = useState(false);

 const handleDeleteHomework = () => {
 if (window.confirm("Ushbu topshiriqni butunlay o'chirib tashlamoqchimisiz?")) {
 setDeleteLoading(true);
 api.delete(`/homework_attends/homeworks/${mission_id}/`)
 .then(() => {
 toast.success("Topshiriq o'chirildi.");
 navigate(-1);
 })
 .catch(err => {
 toast.error("Xatolik yuz berdi.");
 })
 .finally(() => setDeleteLoading(false));
 }
 };

 const calculateStats = () => {
 if (!homeworkData?.students_status || homeworkData.students_status.length === 0) {
 return { percent: 0, fullCount: 0, halfCount: 0, total: 0 };
 }
 const total = homeworkData.students_status.length;
 const fullCount = homeworkData.students_status.filter(s => s.status ==='full').length;
 const halfCount = homeworkData.students_status.filter(s => s.status ==='half').length;
 const totalPoints = (fullCount * 1) + (halfCount * 0.5);
 const percent = Math.round((totalPoints / total) * 100);
 return { percent, fullCount, halfCount, total };
 };

 const updateStatus = async (submissionId, newStatus) => {
  let previousStatus = null;
  let updatedData = null;

  // 1. Optimistik UI yangilash
  setHomeworkData(prev => {
   if (!prev || !prev.students_status) return prev;
   const target = prev.students_status.find(s => s.id === submissionId);
   if (target) {
    previousStatus = target.status;
   }
   updatedData = {
    ...prev,
    students_status: prev.students_status.map(s =>
     s.id === submissionId ? { ...s, status: newStatus } : s
    )
   };
   return updatedData;
  });

  // 2. IndexedDB keshini darhol yangilaymiz
  try {
    if (updatedData) {
      await db.query_cache.put({
        query_key: `homework_detail_${mission_id}`,
        data: updatedData,
        updated_at: new Date().toISOString(),
      });
    }
  } catch (_) {}

  // 3. Agar oflayn bo'lsa — Outbox navbatiga qo'shib darhol qaytamiz
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  if (isOffline) {
    try {
      await db.sync_queue.add({
        action: 'update',
        entity: 'homework_submission',
        data: {
          mission_id,
          submission_id: submissionId,
          status: newStatus,
        },
        created_at: new Date().toISOString(),
        status: 'pending',
      });
    } catch (_) {}
    toast.success("Oflayn saqlandi! Internet tiklanganda yuboriladi.", { icon: "💾", duration: 2500 });
    return;
  }

  // 4. Onlayn bo'lsa serverga yuboramiz
  api.patch(`/homework_attends/homeworks/${mission_id}/update_student_status/`, {
   submission_id: submissionId,
   status: newStatus
  })
  .catch(async (err) => {
   // Tarmoq xatosi bo'lsa (offline yoki timeout) — rollback QILMAYMIZ, Outbox ga qo'yamiz!
   const isNetworkError = !err.response || err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED';
   if (isNetworkError) {
     try {
       await db.sync_queue.add({
         action: 'update',
         entity: 'homework_submission',
         data: {
           mission_id,
           submission_id: submissionId,
           status: newStatus,
         },
         created_at: new Date().toISOString(),
         status: 'pending',
       });
       toast.success("Lokal saqlandi! Internet tiklanganda yuboriladi.", { icon: "💾", duration: 3000 });
     } catch (_) {}
     return;
   }

   // Server biznes mantiq xatosi (400/404) bergandagina rollback qilamiz
   console.error("Holatni saqlashda xatolik:", err);
   toast.error("Holatni saqlashda xatolik yuz berdi");
   if (previousStatus !== null) {
    setHomeworkData(prev => {
     if (!prev || !prev.students_status) return prev;
     return {
      ...prev,
      students_status: prev.students_status.map(s =>
       s.id === submissionId ? { ...s, status: previousStatus } : s
      )
     };
    });
   }
  });
 };

 useEffect(() => {
  let isMounted = true;

  // 1. Dastlab IndexedDB keshidan darhol o'qiymiz (0ms delay)
  db.query_cache.get(`homework_detail_${mission_id}`).then(cached => {
    if (isMounted && cached?.data) {
      setHomeworkData(cached.data);
      setLoading(false);
    }
  }).catch(() => {});

  // 2. Agar onlayn bo'lsa serverdan eng so'nggi ma'lumotni olib yangilaymiz
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    api.get(`/homework_attends/homeworks/${mission_id}/`)
    .then(res => {
      if (isMounted) {
        setHomeworkData(res.data);
        setLoading(false);
      }
      db.query_cache.put({
        query_key: `homework_detail_${mission_id}`,
        data: res.data,
        updated_at: new Date().toISOString(),
      }).catch(() => {});
    })
    .catch(() => {
      if (isMounted) setLoading(false);
    });
  } else {
    setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 0);
  }

  return () => {
    isMounted = false;
  };
 }, [mission_id]);

 return {
 mission_id,
 homeworkData,
 loading,
 deleteLoading,
 handleDeleteHomework,
 updateStatus,
 stats: calculateStats()
 };
};
