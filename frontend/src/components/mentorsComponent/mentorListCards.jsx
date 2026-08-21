import { useState } from"react";
import { useNavigate } from"react-router-dom";
import { UserSquare2, Phone, BookOpen, Users, ChevronRight } from"lucide-react";
import api from"../../tokenUpdater/updater";

export default function MentorRow({ mentor, currentBranchId }) {

 const navigate = useNavigate();
 const [selectedColor, setSelectedColor] = useState(mentor.color ||"#ffffff");
 const [showPicker, setShowPicker] = useState(false);
 // Rangni saqlash logikasi
 const handleSaveColor = async (e) => {
 e.stopPropagation(); // Qator bosilib ketishini to'xtatadi
 setShowPicker(false);
 try {
 await api.patch(`/register/users/${mentor.id}/`, { color: selectedColor });
 } catch (error) {
 setSelectedColor(mentor.color); // Xato bo'lsa eski rangga qaytarish
 }
 };

 return (
 <tr
 onClick={() => navigate(`${mentor.id}/?branch=${currentBranchId}`)}
 className="group hover:bg-white/[0.03] transition-colors cursor-pointer"
 >
 <td className="px-6 py-4">
 <div className="flex items-center gap-3">
 {/* Avatar qismi tanlangan rang bilan */}
 <div
 className="w-12 h-12 border border-white/10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
 style={{
 backgroundColor: `${selectedColor}20`, // 20 - bu 12% li shaffoflik
 borderColor: `${selectedColor}50`
 }}
 >
 {!mentor.image ? <UserSquare2 size={20} style={{ color: selectedColor }} /> : <img src={mentor.image} alt="" />}
 </div>
 <div>
 <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
 {mentor.first_name} {mentor.last_name}
 </p>
 <p className="text-[10px] text-gray-500 font-medium">@{mentor.username}</p>
 </div>
 </div>
 </td>

 <td className="px-6 py-4">
 <div className="flex items-center gap-2 text-xs text-gray-400">
 <Phone size={12} className="text-blue-500/50" />
 {mentor.phone_number ||"---"}
 </div>
 </td>

 <td className="px-6 py-4">
 <div className="flex items-center gap-2 text-xs text-gray-400">
 <BookOpen size={12} className="text-purple-500/50" />
 {mentor.subject ||"Belgilanmagan"}
 </div>
 </td>

 <td className="px-6 py-4 text-center">
 <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/5 rounded-lg border border-white/5">
 <Users size={12} className="text-indigo-500" />
 <span className="text-xs font-bold text-white">
 {mentor?.mentor_groups?.length || 0}
 </span>
 </div>
 </td>

 <td className="px-6 py-4 text-center">
 <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold capitalize tracking-wider ${mentor.is_active
 ?"bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
 :"bg-red-500/10 border-red-500/20 text-red-500"
 }`}>
 <div className={`w-1 h-1 rounded-full ${mentor.is_active ?"bg-emerald-500" :"bg-red-500"}`}></div>
 {mentor.is_active ?"Faol" :"Nofaol"}
 </div>
 </td>

 {/* RANGNI TAHRIRLASH QISMI */}
 <td className="px-6 py-4 text-right relative">
 <div className="flex items-center justify-end gap-3">
 <div
 onClick={(e) => {
 e.stopPropagation();
 setShowPicker(!showPicker);
 }}
 className="w-6 h-6 rounded-md cursor-pointer border border-white/20 hover:scale-120 transition-all shadow-inner"
 style={{ backgroundColor: selectedColor }}
 title="Rangni o'zgartirish"
 ></div>

 <ChevronRight size={18} className="text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
 </div>

 {/* Floating Color Picker */}
 {showPicker && (
 <div
 onClick={(e) => e.stopPropagation()}
 className="absolute right-16 top-0 z-50 bg-[#1f2229] border border-gray-700 rounded-lg p-2 shadow-2xl flex flex-col items-center gap-2 min-w-[60px]"
 >
 <input
 type="color"
 value={selectedColor}
 onChange={(e) => setSelectedColor(e.target.value)}
 className="w-8 h-8 cursor-pointer bg-transparent border-none"
 />
 <button
 onClick={handleSaveColor}
 className="bg-blue-600 hover:bg-blue-700 text-[10px] text-white px-2 py-1 rounded font-bold w-full"
 >
 OK
 </button>
 </div>
 )}
 </td>
 </tr>
 );
}