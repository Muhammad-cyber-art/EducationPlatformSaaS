import React from "react";
import { useKassa } from "./useKassa";
import KassaHeader from "./KassaHeader";
import KassaFilters from "./KassaFilters";
import KassaContent from "./KassaContent";
import WithdrawModal from "./WithdrawModal";
import DetailModal from "./DetailModal";

const Kassa = () => {
    const {
        navigate,
        payments,
        withdrawals,
        loading,
        loadingMore,
        hasMorePayments,
        hasMoreWithdrawals,
        loadMore,
        branches,
        selectedPayment,
        setSelectedPayment,
        showDetailModal,
        setShowDetailModal,
        showWithdrawModal,
        setShowWithdrawModal,
        withdrawData,
        setWithdrawData,
        isSubmitting,
        activeTab,
        setActiveTab,
        filters,
        setFilters,
        userInfo,
        handleAmountChange,
        handleWithdraw,
        handleVerify,
        totalToday,
        totalVerified,
        totalWithdrawn,
        clearFilters,
        setToday
    } = useKassa();

    const isSuperAdmin = userInfo?.role === 'super_admin';

    const openDetail = (payment) => {
        setSelectedPayment(payment);
        setShowDetailModal(true);
    };

    const closeDetail = () => {
        setShowDetailModal(false);
        setSelectedPayment(null);
    };

    const handleVerifyAndClose = async (paymentId) => {
        await handleVerify(paymentId);
        if (selectedPayment && selectedPayment.id === paymentId) {
            setShowDetailModal(false);
        }
    };

    return (
        <>
            <div className="space-y-8 animate-lux-fade pb-10 relative">
                <div className="fixed inset-0 pointer-events-none -z-10">
                    <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-[var(--gold)]/5 rounded-full blur-[120px]"></div>
                </div>

                <KassaHeader
                    navigate={navigate}
                    totalToday={totalToday}
                    totalVerified={totalVerified}
                    totalWithdrawn={totalWithdrawn}
                    onWithdraw={() => setShowWithdrawModal(true)}
                    isSuperAdmin={isSuperAdmin}
                />

                <KassaFilters
                    filters={filters}
                    setFilters={setFilters}
                    branches={branches}
                    clearFilters={clearFilters}
                    setToday={setToday}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    paymentsCount={payments.length}
                    withdrawalsCount={withdrawals.length}
                />

                <KassaContent
                    activeTab={activeTab}
                    payments={payments}
                    withdrawals={withdrawals}
                    loading={loading}
                    loadingMore={loadingMore}
                    hasMorePayments={hasMorePayments}
                    hasMoreWithdrawals={hasMoreWithdrawals}
                    loadMore={loadMore}
                    isSuperAdmin={isSuperAdmin}
                    onVerify={handleVerifyAndClose}
                    onDetail={openDetail}
                />
            </div>

            <WithdrawModal
                show={showWithdrawModal}
                onClose={() => setShowWithdrawModal(false)}
                onSubmit={handleWithdraw}
                withdrawData={withdrawData}
                setWithdrawData={setWithdrawData}
                isSubmitting={isSubmitting}
                handleAmountChange={handleAmountChange}
                branches={branches}
                filters={filters}
                isSuperAdmin={isSuperAdmin}
            />

            <DetailModal
                show={showDetailModal}
                payment={selectedPayment}
                onClose={closeDetail}
                onVerify={handleVerifyAndClose}
                isSuperAdmin={isSuperAdmin}
            />
        </>
    );
};

export default Kassa;
