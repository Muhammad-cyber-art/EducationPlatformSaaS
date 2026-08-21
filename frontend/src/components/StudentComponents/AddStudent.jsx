import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAddStudent } from './useAddStudent';

// Optimized Sub-components Imports
import IdentitySection from './AddStudentComponents/IdentitySection';
import PersonalDataSection from './AddStudentComponents/PersonalDataSection';
import ParentInfoSection from './AddStudentComponents/ParentInfoSection';
import FinancialSection from './AddStudentComponents/FinancialSection';

const StudentAdd = () => {
  const { branchId } = useOutletContext() || {};
  
  const {
    formData, setFormData, preview, loading, searchResults, searching, groups, enrollmentToggles, setEnrollmentToggles,
    hasGroupId, paramGroupId, handleChange, handleImageChange, removeImage, handleEnrollExisting, handleSubmit, navigate
  } = useAddStudent(branchId);

  return (
    <div className="animate-lux-fade">
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[var(--gold)]/5 rounded-full blur-[140px]"></div>
      </div>

      <div className="max-w-[1400px] mx-auto">
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
    </div>
  );
};

export default StudentAdd;