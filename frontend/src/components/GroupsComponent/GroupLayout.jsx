import { Outlet } from"react-router-dom";
import { useOutletContext } from"react-router-dom";

export default function GroupsLayout(){
 const { branchId } = useOutletContext() || {}; 

 return <div>
 <Outlet context={{branchId : branchId}}/>
 </div>
}