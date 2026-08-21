import { useState } from"react";
import { useQuery, useQueryClient } from"@tanstack/react-query";
import api from"../../../tokenUpdater/updater";
import toast from"react-hot-toast";

export const useHomeworkStorage = (isOpen, groupId) => {
 const [selectedHomework, setSelectedHomework] = useState(null);
 const [searchTerm, setSearchTerm] = useState("");
 const queryClient = useQueryClient();

 const { data: archivedHomeworksRaw, isLoading, refetch } = useQuery({
 queryKey: ['archived-homeworks', groupId],
 queryFn: () => api.get(`/archive/homework-storage/?group_id=${groupId}`).then(res => res.data),
 enabled: isOpen && !!groupId,
 });
 const archivedHomeworks = archivedHomeworksRaw?.results || archivedHomeworksRaw || [];

 const handleClearAll = async () => {
 if (!confirm("Diqqat! Ushbu guruhning barcha arxiv ma'lumotlarini butunlay o'chirib tashlamoqchimisiz? Bu amalni orqaga qaytarib bo'lmaydi.")) return;
 try {
 await api.delete(`/archive/homework-storage/clear_all/?group_id=${groupId}`);
 toast.success("Arxiv tozalandi.");
 setSelectedHomework(null);
 refetch();
 } catch (err) {
 toast.error("Tozalashda xatolik yuz berdi.");
 }
 };

 const filteredItems = archivedHomeworks.filter(hw =>
 hw.full_name.toLowerCase().includes(searchTerm.toLowerCase())
 );

 const formatCurrency = (amount) => {
 return new Intl.NumberFormat('uz-UZ').format(amount);
 };

 const getStatusColor = (status) => {
 switch (status) {
 case'To‘liq topshirgan':
 case'Qatnashgan': return'text-emerald-400';
 case'Yarim topshirgan': return'text-amber-400';
 case'Topshirmagan':
 case'Qatnashmagan': return'text-rose-400';
 default: return'text-white/60';
 }
 };

 return {
 selectedHomework,
 setSelectedHomework,
 searchTerm,
 setSearchTerm,
 isLoading,
 handleClearAll,
 filteredItems,
 formatCurrency,
 getStatusColor
 };
};
