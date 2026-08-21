import React from"react";
import { useMentorFinance } from"./Finance/useMentorFinance";
import { 
 FinanceHeader, MentorInfoCard, FinanceStatsGrid, 
 MentorGroupsTable, PaymentHistoryList, LoadingState, ErrorState 
} from"./Finance/FinanceComponents";

const MentorFinance = () => {
 const { 
 data, loading, error, navigate, 
 formatCurrency, formatPercentage, isPercentageType 
 } = useMentorFinance();

 if (loading) return <LoadingState />;
 if (error || !data) return <ErrorState error={error} onBack={() => navigate(-1)} />;

 return (
 <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-secondary)] font-sans selection:bg-[var(--gold)]/30 p-4 md:p-8">
 <div className="max-w-6xl mx-auto space-y-8">
 <FinanceHeader month={data.month} />

 <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
 {/* LEFT COLUMN - USER INFO */}
 <div className="lg:col-span-4 space-y-6">
 <MentorInfoCard data={data} isPercentageType={isPercentageType} />
 </div>

 {/* RIGHT COLUMN - FINANCIALS */}
 <div className="lg:col-span-8 space-y-8">
 <FinanceStatsGrid 
 data={data} 
 isPercentageType={isPercentageType} 
 formatCurrency={formatCurrency} 
 formatPercentage={formatPercentage} 
 />

 {isPercentageType && data.mentor_groups && data.mentor_groups.length > 0 && (
 <MentorGroupsTable data={data} formatCurrency={formatCurrency} />
 )}

 <PaymentHistoryList history={data.payment_history} formatCurrency={formatCurrency} />
 </div>
 </div>
 </div>
 </div>
 );
};

export default MentorFinance;
