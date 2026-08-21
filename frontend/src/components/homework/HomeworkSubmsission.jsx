import React from'react';
import { useHomeworkSubmission } from'./Submission/useHomeworkSubmission';
import { 
 SubmissionHeader, SubmissionAnalytics, SubmissionList 
} from'./Submission/SubmissionComponents';
import { Loader2 } from"lucide-react";

const HomeworkSubmission = () => {
 const { 
 mission_id, homeworkData, loading, 
 deleteLoading, handleDeleteHomework, updateStatus, stats 
 } = useHomeworkSubmission();

 if (loading) return (
 <div className="min-h-screen bg-[var(--bg-void)] flex flex-col items-center justify-center gap-6">
 <Loader2 className="animate-spin text-[var(--gold)]" size={48} />
 <p className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-[0.4em]">Ma'lumotlar yuklanmoqda...</p>
 </div>
 );

 if (!homeworkData) return (
 <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center text-[var(--text-muted)] font-bold capitalize tracking-widest text-center">
 MA'LUMOT TOPILMADI
 </div>
 );

 return (
 <div className="min-h-screen bg-[var(--bg-void)] p-3 md:p-8 text-[var(--text-primary)] font-sans selection:bg-[var(--gold)]/30 animate-lux-fade">
 <div className="fixed inset-0 pointer-events-none -z-10">
 <div className="absolute top-1/4 -right-20 w-80 h-80 rounded-full blur-[100px] bg-[var(--gold)] opacity-5"></div>
 </div>

 <div className="max-w-[1200px] mx-auto space-y-6 md:space-y-10">
 <div className="lux-card !p-5 md:!p-8 relative overflow-hidden group">
 <SubmissionHeader 
 homeworkData={homeworkData} 
 mission_id={mission_id} 
 onDelete={handleDeleteHomework} 
 deleteLoading={deleteLoading} 
 />
 <SubmissionAnalytics stats={stats} />
 </div>

 <SubmissionList 
 students_status={homeworkData.students_status} 
 updateStatus={updateStatus} 
 />
 </div>
 </div>
 );
};

export default HomeworkSubmission;