import { Outlet } from"react-router-dom"
import { useOutletContext } from"react-router-dom"; 

export default function AdminLayout(){
 const { branchId } = useOutletContext() || {};
 return <Outlet context={{ branchId: branchId }} />
}