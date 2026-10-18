import { Outlet, useOutletContext } from "react-router-dom";

export default function StudentLayout() {
 const { branchId } = useOutletContext() || {};

 return (
 <>
 <Outlet context={{ branchId: branchId }} />
 </>
 );
}
