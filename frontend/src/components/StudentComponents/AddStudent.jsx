import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, FileSpreadsheet, Camera } from 'lucide-react';
import { useAddStudent } from './useAddStudent';

// Optimized Sub-components Imports
import IdentitySection from './AddStudentComponents/IdentitySection';
import PersonalDataSection from './AddStudentComponents/PersonalDataSection';
import ParentInfoSection from './AddStudentComponents/ParentInfoSection';
import FinancialSection from './AddStudentComponents/FinancialSection';
import BulkImportStudentModal from './BulkImportStudentModal';

const StudentAdd = () => {
  const { branchId } = useOutletContext() || {};
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  const {
    formData, setFormData, preview, loading, searchResults, searching, groups, enrollmentToggles, setEnrollmentToggles,
    hasGroupId, paramGroupId, handleChange, handleImageChange, removeImage, handleEnrollExisting, handleSubmit, navigate
  } = useAddStudent(branchId);

  return (
    <div className="animate-lux-fade">
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[var(--gold)]/5 rounded-full blur-[140px]"></div>
      </div>

      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Yuqori panel: Rasm yoki fayldan ommaviy yuklash tugmasi */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-white/[0.04] to-white/[0.01] border border-white/10 shadow-xl">
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
              <span>Yangi o'quvchi qo'shish</span>
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Qo'lda to'ldirishingiz yoki tayyor Excel / Rasm (kamera) faylini import qilishingiz mumkin
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="lux-btn flex items-center gap-2.5 !px-6 !py-3.5 !bg-[var(--gold)]/10 hover:!bg-[var(--gold)]/20 !border-[var(--gold)]/30 !text-[var(--gold)] font-bold text-xs rounded-2xl shadow-[0_4px_20px_rgba(212,175,55,0.15)] transition-all transform hover:-translate-y-0.5 cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <FileSpreadsheet size={16} />
              <Camera size={15} />
            </div>
            <span>Rasm yoki fayl orqali o'quvchi qo'shish</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <IdentitySection
            navigate={navigate}
            hasGroupId={hasGroupId}
            paramGroupId={paramGroupId}
            preview={preview}
            handleImageChange={handleImageChange}
            removeImage={removeImage}
            notes={formData.notes}
            handleChange={handleChange}
          />

          <div className="lg:col-span-8 space-y-6">
            <PersonalDataSection
              hasGroupId={hasGroupId}
              groups={groups}
              formData={formData}
              handleChange={handleChange}
              searching={searching}
              searchResults={searchResults}
              enrollmentToggles={enrollmentToggles}
              setEnrollmentToggles={setEnrollmentToggles}
              handleEnrollExisting={handleEnrollExisting}
            />

            <ParentInfoSection formData={formData} handleChange={handleChange} />

            <FinancialSection formData={formData} setFormData={setFormData} handleChange={handleChange} />

            <div className="flex justify-end gap-5 pt-10 pb-20">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="lux-btn !px-10 !border-[var(--border-glass)] !text-[var(--text-secondary)] hover:!text-white font-black capitalize text-[10px]"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={loading}
                className="lux-btn lux-btn-primary !px-16 !h-16 shadow-[0_10px_40px_rgba(184,134,11,0.2)] text-[11px] font-black capitalize tracking-widest"
              >
                {loading ? "Saqlanmoqda..." : "O'quvchini saqlash"}
                {!loading && <Plus size={18} className="ml-2" />}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Rasm yoki Fayl orqali import qilish Modali */}
      <BulkImportStudentModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        branchId={formData.branch_id || branchId}
        groupId={hasGroupId ? paramGroupId : formData.group || ""}
        groups={groups}
        onSuccess={() => {
          // Muvaffaqiyatli qo'shilgandan keyin orqaga qaytish yoki yangilash
        }}
      />
    </div>
  );
};

export default StudentAdd;
