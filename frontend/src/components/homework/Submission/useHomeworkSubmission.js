import { useEffect, useState } from'react';
import { useParams, useNavigate } from'react-router-dom';
import api from"../../../tokenUpdater/updater";
import toast from"react-hot-toast";

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

 const updateStatus = (submissionId, newStatus) => {
  let previousStatus = null;
  setHomeworkData(prev => {
   if (!prev || !prev.students_status) return prev;
   const target = prev.students_status.find(s => s.id === submissionId);
   if (target) {
    previousStatus = target.status;
   }
   return {
    ...prev,
    students_status: prev.students_status.map(s =>
     s.id === submissionId ? { ...s, status: newStatus } : s
    )
   };
  });

  api.patch(`/homework_attends/homeworks/${mission_id}/update_student_status/`, {
   submission_id: submissionId,
   status: newStatus
  })
  .catch(err => {
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
 api.get(`/homework_attends/homeworks/${mission_id}/`)
 .then(res => {
 setHomeworkData(res.data);
 setLoading(false);
 })
 .catch(err => {
 setLoading(false);
 });
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
