import { useState, useEffect } from"react";
import api from"../../../tokenUpdater/updater";
import toast from"react-hot-toast";

export const useWaitingHall = (activeBranchId) => {
 const [students, setStudents] = useState([]);
 const [loading, setLoading] = useState(true);
 const [groups, setGroups] = useState([]);
 const [loadingGroups, setLoadingGroups] = useState(false);

 const fetchWaitingStudents = async () => {
 if (!activeBranchId) return;
 setLoading(true);
 try {
 const res = await api.get(`/groups/waiting-students/?branch=${activeBranchId}`);
 setStudents(res.data.results || res.data);
 } catch (error) {
 toast.error("Kutishlar zalini yuklashda xato!");
 } finally {
 setLoading(false);
 }
 };

 const fetchGroups = async () => {
 if (!activeBranchId) return;
 setLoadingGroups(true);
 try {
 const res = await api.get(`/groups/nested_groups/?branch_id=${activeBranchId}&page_size=200`);
 const data = res.data;
 if (data && Array.isArray(data.results)) {
  setGroups(data.results);
 } else if (Array.isArray(data)) {
  setGroups(data);
 } else {
  setGroups([]);
 }
 } catch (error) {
 toast.error("Guruhlarni yuklashda xato!");
 setGroups([]);
 } finally {
 setLoadingGroups(false);
 }
 };

 useEffect(() => {
 fetchWaitingStudents();
 }, [activeBranchId]);

 const handleDelete = async (id) => {
 if (!window.confirm("O'quvchini ro'yxatdan o'chirmoqchimisiz?")) return;
 try {
 await api.delete(`/groups/waiting-students/${id}/`);
 toast.success("O'chirildi");
 fetchWaitingStudents();
 } catch (error) {
 toast.error("O'chirishda xatolik!");
 }
 };

 const handleAssignToGroup = async (studentId, groupId) => {
 try {
 await api.post(`/groups/waiting-students/${studentId}/assign-to-group/`, {
 group_id: groupId
 });
 toast.success("O'quvchi guruhga muvaffaqiyatli biriktirildi!");
 fetchWaitingStudents();
 return true;
 } catch (error) {
 toast.error("Biriktirishda xatolik!");
 return false;
 }
 };

 const handleAddStudent = async (formData) => {
 try {
 await api.post("/groups/waiting-students/", {
 ...formData,
 branch: activeBranchId
 });
 toast.success("O'quvchi kutishlar zaliga qo'shildi");
 fetchWaitingStudents();
 return true;
 } catch (error) {
 toast.error("Qo'shishda xatolik!");
 return false;
 }
 };

 return {
 students,
 loading,
 groups,
 loadingGroups,
 fetchGroups,
 handleDelete,
 handleAssignToGroup,
 handleAddStudent
 };
};
