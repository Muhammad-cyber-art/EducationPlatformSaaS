import { div } from"framer-motion/client";
import { Outlet } from"react-router-dom";
import { useOutletContext } from"react-router-dom";

export default function StudentLayout() {
 const { branchId } = useOutletContext() || {};

 return (
 <>
 <Outlet context={{ branchId: branchId }} />
 </>
 );
}
