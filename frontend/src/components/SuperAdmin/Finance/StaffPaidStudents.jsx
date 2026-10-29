import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import api from "../../../tokenUpdater/updater";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";

import StaffPaidHeader from "./StaffPaidStudents/StaffPaidHeader";
import StaffPaidKPICards from "./StaffPaidStudents/StaffPaidKPICards";
import StaffPaidFilters from "./StaffPaidStudents/StaffPaidFilters";
import StaffPaidTable from "./StaffPaidStudents/StaffPaidTable";
import StaffPaidDetailDrawer from "./StaffPaidStudents/StaffPaidDetailDrawer";

const StaffPaidStudents = () => {
  const { staff_id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialGroupId = searchParams.get("group_id") || "all";

  const [loading, setLoading] = useState(true);
  const [pageData, setPageData] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(initialGroupId);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [activeTabFilter, setActiveTabFilter] = useState("all"); // 'all' | 'paid' | 'special' | 'debt'

  // Detailed modal/drawer inspection state
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [detailsCache, setDetailsCache] = useState({});

  // 1. Fetch all students & shares (Single batch request with prefetch)
  const fetchPaidStudents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/finance/employee-payments/${staff_id}/paid-students/`);
      setPageData(res.data);
    } catch (err) {
      console.error("Paid students fetch error:", err);
      toast.error(err.response?.data?.detail || "To'langan o'quvchilar ro'yxatini yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  }, [staff_id]);

  useEffect(() => {
    fetchPaidStudents();
    window.scrollTo(0, 0);
  }, [fetchPaidStudents]);

  // 2. Fetch specific student calculation detail on click (with caching to avoid N+1 queries)
  const handleSelectStudent = useCallback(
    async (student) => {
      setSelectedStudent(student);
      const cacheKey = `${student.id}_${student.group_id}`;

      if (detailsCache[cacheKey]) {
        setDetailData(detailsCache[cacheKey]);
        return;
      }

      try {
        setDetailLoading(true);
        const res = await api.get(
          `/finance/employee-payments/${staff_id}/student-calculation-detail/`,
          {
            params: {
              student_id: student.id,
              group_id: student.group_id,
            },
          }
        );
        setDetailData(res.data);
        setDetailsCache((prev) => ({ ...prev, [cacheKey]: res.data }));
      } catch (err) {
        console.error("Student detail fetch error:", err);
        toast.error(err.response?.data?.detail || "O'quvchi hisob-kitobini yuklashda xatolik");
      } finally {
        setDetailLoading(false);
      }
    },
    [staff_id, detailsCache]
  );

  const handleCloseDrawer = useCallback(() => {
    setSelectedStudent(null);
    setDetailData(null);
  }, []);

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  // Total debtors count across all loaded students
  const totalDebtorsCount = useMemo(() => {
    if (pageData?.total_debtors_count !== undefined) {
      return pageData.total_debtors_count;
    }
    if (!pageData?.students) return 0;
    return pageData.students.filter(
      (s) => s.is_debtor || (Number(s.paid_amount || 0) === 0 && s.status !== "discount")
    ).length;
  }, [pageData?.total_debtors_count, pageData?.students]);

  // Filtered students list
  const filteredStudents = useMemo(() => {
    if (!pageData?.students) return [];
    return pageData.students.filter((st) => {
      // Group filter
      if (selectedGroup !== "all" && String(st.group_id) !== String(selectedGroup)) {
        return false;
      }
      // Status dropdown filter
      if (selectedStatus !== "all" && st.status !== selectedStatus) {
        return false;
      }
      // Quick tabs filter
      if (activeTabFilter === "special") {
        if (!["discount", "low_income", "negotiated", "teacher_negotiated"].includes(st.status)) {
          return false;
        }
      } else if (activeTabFilter === "paid") {
        // Includes full payments and partial payments (paid_amount > 0 or state_receivable_amount > 0)
        const paidAmt = Number(st.paid_amount || 0);
        const stateAmt = Number(st.state_receivable_amount || 0);
        if (paidAmt <= 0 && stateAmt <= 0) {
          return false;
        }
      } else if (activeTabFilter === "debt") {
        // IMPORTANT: Partial payers are NOT debtors!
        // Only students with 0 paid and not discount are debtors.
        const isDebtor = Boolean(
          st.is_debtor || (Number(st.paid_amount || 0) === 0 && st.status !== "discount")
        );
        if (!isDebtor) {
          return false;
        }
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const nameMatch = (st.name || "").toLowerCase().includes(query);
        const phoneMatch = (st.phone || "").toLowerCase().includes(query);
        const groupMatch = (st.group_name || "").toLowerCase().includes(query);
        if (!nameMatch && !phoneMatch && !groupMatch) return false;
      }
      return true;
    });
  }, [pageData?.students, selectedGroup, selectedStatus, activeTabFilter, searchQuery]);

  // Dynamic totals for currently filtered list
  const filteredTotals = useMemo(() => {
    return filteredStudents.reduce(
      (acc, s) => {
        const isDisc = s.status === "discount";
        if (!isDisc) {
          acc.paid += Number(s.paid_amount || 0);
          acc.margin += Number(s.center_gross_margin || 0);
        } else {
          acc.estimatedStateReceivable += Number(s.estimated_state_receivable || 0);
          acc.estimatedStateMargin += Number(s.estimated_center_margin || 0);
        }
        acc.share += Number(s.mentor_share || 0);
        acc.planned += Number(s.n_total || 0);
        acc.attended += Number(s.n_attended || 0);
        return acc;
      },
      {
        paid: 0,
        share: 0,
        margin: 0,
        estimatedStateReceivable: 0,
        estimatedStateMargin: 0,
        planned: 0,
        attended: 0,
      }
    );
  }, [filteredStudents]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-[var(--gold)]" size={36} />
          <p className="text-[11px] font-black text-[var(--text-muted)] uppercase tracking-widest animate-pulse">
            O'quvchilar va ulushlar hisob-kitobi yuklanmoqda...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-secondary)] font-sans selection:bg-[var(--gold)]/30 pb-20">
      <div className="max-w-[1520px] mx-auto p-4 md:p-6 space-y-6">
        {/* Navigation & Header Subcomponent */}
        <StaffPaidHeader
          pageData={pageData}
          onBack={handleBack}
          onRefresh={fetchPaidStudents}
          loading={loading}
        />

        {/* 7 KPI Summary Cards Subcomponent */}
        <StaffPaidKPICards
          pageData={pageData}
          filteredStudentsLength={filteredStudents.length}
          filteredTotals={filteredTotals}
        />

        {/* Status Counters & Filter Toolbar Subcomponent */}
        <StaffPaidFilters
          pageData={pageData}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedGroup={selectedGroup}
          setSelectedGroup={setSelectedGroup}
          selectedStatus={selectedStatus}
          setSelectedStatus={setSelectedStatus}
          activeTabFilter={activeTabFilter}
          setActiveTabFilter={setActiveTabFilter}
          totalDebtorsCount={totalDebtorsCount}
        />

        {/* Students Table Subcomponent */}
        <StaffPaidTable
          filteredStudents={filteredStudents}
          selectedStudent={selectedStudent}
          onSelectStudent={handleSelectStudent}
        />

        {/* Detailed Arithmetic Breakdown Drawer Subcomponent */}
        <StaffPaidDetailDrawer
          selectedStudent={selectedStudent}
          detailData={detailData}
          detailLoading={detailLoading}
          onClose={handleCloseDrawer}
        />
      </div>
    </div>
  );
};

export default StaffPaidStudents;
