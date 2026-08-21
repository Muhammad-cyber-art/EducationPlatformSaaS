import React, { useState } from "react";
import StudentWalletTab from "./StudentWalletTab";
import StudentHistorySection from "./StudentHistorySection";

export default function StudentFinanceSection({
  studentData,
  payments,
  extraTransactions,
  ledgerTransactions,
  transfers,
  userRole,
  handlePaymentConfirm,
  handleDeleteHistory,
  canConfirmPayment,
  studentStatus,
  dispatch,
}) {
  const [activeTab, setActiveTab] = useState("history"); // 'wallet' or 'history'

  return (
    <div className="space-y-4">
      {/* TABS NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-[var(--border-glass)] pb-2 mb-4">
        {/* Hamyon & Balans TAB */}
        <button
          className={`px-4 py-2 text-sm font-bold uppercase tracking-wider rounded-t-lg transition-all ${activeTab === "wallet"
            ? "bg-[var(--gold)]/10 text-[var(--gold)] border-b-2 border-[var(--gold)]"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-void)]/30"
            }`}
          onClick={() => setActiveTab("wallet")}
        >
          Hamyon & Balans
        </button>

        <button
          className={`px-4 py-2 text-sm font-bold uppercase tracking-wider rounded-t-lg transition-all ${activeTab === "history"
            ? "bg-[var(--gold)]/10 text-[var(--gold)] border-b-2 border-[var(--gold)]"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-void)]/30"
            }`}
          onClick={() => setActiveTab("history")}
        >
          To'lov qilish
        </button>
      </div>

      {/* TABS CONTENT */}
      <div className="pt-2 animate-in fade-in duration-300">
        {/* Hamyon Tab UI */}
        {activeTab === "wallet" && (
          <StudentWalletTab
            studentData={studentData}
            payments={payments}
            extraTransactions={extraTransactions}
            ledgerTransactions={ledgerTransactions}
            canConfirmPayment={canConfirmPayment}
            dispatch={dispatch}
          />
        )}

        {activeTab === "history" && (
          <StudentHistorySection
            payments={payments}
            extraTransactions={extraTransactions}
            transfers={transfers}
            canConfirmPayment={canConfirmPayment}
            userRole={userRole}
            handlePaymentConfirm={handlePaymentConfirm}
            handleDeleteHistory={handleDeleteHistory}
            studentStatus={studentStatus}
            dispatch={dispatch}
          />
        )}
      </div>
    </div>
  );
}
