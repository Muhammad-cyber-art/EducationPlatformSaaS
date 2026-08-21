import React from "react";
import StaffTransferModal from "../../SuperAdmin/StaffTransferModal";

const AdminModals = ({
    state,
    admin,
    dispatch,
    queryClient,
    toast
}) => {
    const { isTransferModalOpen } = state;

    return (
        <>
            <StaffTransferModal
                isOpen={isTransferModalOpen}
                onClose={() => dispatch({ type: 'TOGGLE_TRANSFER_MODAL', payload: false })}
                staffMember={admin || {}}
                onTransferSuccess={() => {
                    queryClient.invalidateQueries(['admin']);
                    if (toast) toast.success("Ko'chirish tasdiqlandi.");
                }}
            />
        </>
    );
};

export default AdminModals;
