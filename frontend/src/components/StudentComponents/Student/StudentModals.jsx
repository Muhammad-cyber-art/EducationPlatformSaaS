import React from"react";
import PaymentModal from"../PaymentModal";
import TransferStudentModal from"../TransferStudentModal";
import MergeStudentModal from"../MergeStudentModal";
import api from"../../../tokenUpdater/updater";
import { SmallFormModal } from"./Modals/SmallFormModal";
import { ExtraPaymentModal } from"./Modals/ExtraPaymentModal";
import { PaymentConfirmModal } from"./Modals/PaymentConfirmModal";

const StudentModals = ({
 state,
 studentData,
 userData,
 primaryGroup,
 paymentMutation,
 editPaymentMutation,
 customPaymentMutation,
 mergeMutation,
 handlePaymentConfirm,
 executePaymentConfirm,
 dispatch,
 queryClient
}) => {
 const {
 isModalOpen, isTransferModalOpen, isEditPaymentModalOpen,
 isCustomPaymentModalOpen, isMergeModalOpen, isConfirmPaymentModalOpen, 
 selectedPayment, confirmPaymentData
 } = state;

 return (
 <>
 <PaymentModal
 isOpen={isModalOpen}
 onClose={() => dispatch({ type:'TOGGLE_MODAL', payload: false })}
 onConfirm={(amount) => handlePaymentConfirm(null, amount)}
 amount={studentData?.custom_fee || primaryGroup?.monthly_price}
 loading={paymentMutation.isPending}
 />

 <SmallFormModal
 isOpen={isEditPaymentModalOpen}
 onClose={() => dispatch({ type:'TOGGLE_EDIT_PAYMENT', payload: false })}
 onSave={(val) => editPaymentMutation.mutate({ id: selectedPayment?.id, amount: val })}
 title="To'lov summasini tahrirlash"
 initialValue={selectedPayment?.amount}
 label="Yangi summa (UZS)"
 isPaid={selectedPayment?.is_paid}
 />

 <ExtraPaymentModal
 isOpen={isCustomPaymentModalOpen}
 onClose={() => dispatch({ type:'TOGGLE_CUSTOM_PAYMENT', payload: false })}
 onSave={(data) => customPaymentMutation.mutate(data)}
 loading={customPaymentMutation.isPending}
 studentName={studentData?.full_name}
 adminName={userData?.first_name ? `${userData.first_name} ${userData.last_name ||''}` : userData?.username}
 groups={studentData?.groups || []}
 />

 <TransferStudentModal
 isOpen={isTransferModalOpen}
 onClose={() => dispatch({ type:'TOGGLE_TRANSFER_MODAL', payload: false })}
 student={studentData}
 fromGroup={state.transferFromGroup}
 currentBranchId={studentData?.branch_id}
 api={api}
 onSuccess={() => {
 queryClient.invalidateQueries(['student']);
 queryClient.invalidateQueries(['payments-all']);
 queryClient.invalidateQueries(['student-history', studentData?.id]);
 }}
 />

 <MergeStudentModal
 isOpen={isMergeModalOpen}
 onClose={() => dispatch({ type:'TOGGLE_MERGE_MODAL', payload: false })}
 masterStudent={studentData}
 onMerge={(dupId) => mergeMutation.mutate(dupId)}
 />

 <PaymentConfirmModal
 isOpen={isConfirmPaymentModalOpen}
 onClose={() => dispatch({ type:'TOGGLE_CONFIRM_PAYMENT', payload: false })}
 onConfirm={executePaymentConfirm}
 data={confirmPaymentData}
 loading={paymentMutation.isPending}
 />
 </>
 );
};

export default StudentModals;
