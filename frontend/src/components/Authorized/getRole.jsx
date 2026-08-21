import { jwtDecode } from"jwt-decode";

export function get_user_info() {
 const access = localStorage.getItem("access_token");

 if (!access) {
 return null;
 }

 try {
 const payload = jwtDecode(access);

 // Mantiq: Agar is_superuser true bo'lsa (har xil formatlarda bo'lishi mumkin), roli har doim super_admin bo'ladi
 let effectiveRole = payload.role || null;
 const isSuper = payload.is_superuser === true || payload.is_superuser ==="true" || payload.is_superuser === 1;

 if (isSuper) {
 effectiveRole ="super_admin";
 }

 return {
 user_id: payload.user_id || null,
 role: effectiveRole,
 is_superuser: !!isSuper,
 branch_id: payload.branch_id || null,
 branch_name: payload.branch_name || null,
 accessible_branches: Array.isArray(payload.accessible_branches)
 ? payload.accessible_branches
 : [],
 };
 } catch (error) {
 console.error("JWT token decode xatosi:", error);
 return null;
 }
}
