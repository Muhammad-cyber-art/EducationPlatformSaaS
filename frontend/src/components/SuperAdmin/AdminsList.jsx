import React, { useEffect, useState, useMemo } from 'react';
import GoBackButton from '../sendback';
import { useNavigate, useOutletContext } from "react-router-dom";
import AdminCard from '../adminComponents/AdminCard';
import api from '../../tokenUpdater/updater';
import toast from 'react-hot-toast';
import { Users, Loader2, Plus, Search, LayoutGrid, List } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { get_user_info } from '../Authorized/getRole';

const AdminList = () => {
  const { branchId } = useOutletContext() || {};
  const navigate = useNavigate();
  const [admin, setAdmin] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'grid' | 'list'

  // User details (Cache: Infinity)
  const { data: userData = {} } = useQuery({
    queryKey: ['user-me'],
    queryFn: () => api.get('/user/me/').then(res => res.data),
    staleTime: Infinity,
  });

  const userInfo = get_user_info();
  const perms = userData.permissions || {};
  const isSuperAdmin = userData.role === "super_admin" || userInfo?.role === "super_admin";

  // Super admin always has access
  const canCreateAdmin = isSuperAdmin || perms.branches === true;

  useEffect(() => {
    // Explicitly allow if user is super_admin regardless of perms.branches
    if (userData.id && !isSuperAdmin && perms.branches === false) {
      toast.error("Administratorlar bo'limiga kirish huquqi yo'q!");
      navigate(-1);
    }
  }, [userData.id, perms.branches, isSuperAdmin, navigate]);

  const fetchAdmins = async () => {
    if (!branchId) return;
    setLoading(true);

    try {
      const res = await api.get(`/groups/admins/?branch_id=${branchId}`);
      const data = res.data;
      setAdmin(Array.isArray(data) ? data : data?.results || []);
    } catch (err) {
      console.error(err);
      toast.error("Ma'lumotlarni yuklashda xatolik.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, [branchId]);

  const filteredAdmins = useMemo(() => {
    if (!searchTerm) return admin;
    const lower = searchTerm.toLowerCase();
    return admin.filter(a => 
      `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase().includes(lower) ||
      (a.phone_number || '').toLowerCase().includes(lower)
    );
  }, [admin, searchTerm]);

  return (
    <div className="space-y-6 md:space-y-8 animate-lux-fade pb-10">
      {/* Atmosphere Background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-[var(--gold)]/5 rounded-full blur-[120px]"></div>
      </div>

      {/* HEADER SECTION (Unified with MentorsHeader) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10 pb-10 border-b border-[var(--border-glass)] relative">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <GoBackButton />
            <div className="px-3 py-1 bg-[var(--gold-dim)] rounded-full border border-[var(--gold)]/20">
              <span className="text-[10px] font-black text-[var(--gold)] tracking-[0.2em] capitalize">Filial Administratorlari</span>
            </div>
          </div>
          <h1 className="gold-text !text-2xl sm:!text-4xl">Administratorlar</h1>
          <p className="text-[10px] sm:text-[11px] text-[var(--text-secondary)] font-bold capitalize tracking-[0.3em] sm:tracking-[0.4em] flex items-center gap-2 sm:gap-3">
            Boshqaruv bo'limi <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] opacity-30"></span> {admin.length} NAFAR ADMIN
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 flex-1 max-w-2xl lg:pr-32">
          <div className="relative flex-1 group w-full">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)]">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
            </div>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Qidirish..."
              className="lux-input !pl-12 sm:!pl-14 !py-4 sm:!py-5 shadow-2xl"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {canCreateAdmin && (
              <button
                onClick={() => navigate('admin_add')}
                className="lux-btn lux-btn-primary !px-6 sm:!px-10 !h-[48px] sm:!h-[58px] flex-1 sm:flex-none shadow-xl"
              >
                <Plus size={18} />
                <span>Qo'shish</span>
              </button>
            )}
          </div>
        </div>

        {/* View Toggle Buttons */}
        <div className="absolute top-0 right-0 h-fit bg-[var(--bg-panel)] p-1 rounded-xl border border-[var(--border-glass)] flex gap-1 shadow-lg z-10 transition-transform">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 sm:p-2.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-[var(--gold)] text-black' : 'text-[var(--text-muted)] hover:text-[var(--gold)]'}`}
            title="Grid View"
          >
            <LayoutGrid size={14} className="sm:w-4 sm:h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 sm:p-2.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-[var(--gold)] text-black' : 'text-[var(--text-muted)] hover:text-[var(--gold)]'}`}
            title="List View"
          >
            <List size={14} className="sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="relative min-h-[400px]">
        {/* Empty State */}
        {!loading && filteredAdmins.length === 0 && (
          <div className="lux-card !p-10 md:!p-20 text-center border-dashed border-[var(--border-glass)] opacity-30 !rounded-3xl">
            <Users size={40} md:size={48} className="mx-auto mb-4 md:mb-6 text-[var(--gold)]/50" />
            <p className="text-xs md:text-sm font-bold capitalize tracking-widest text-[var(--text-primary)]">Administratorlar topilmadi</p>
            {searchTerm ? (
              <p className="text-[9px] md:text-[10px] mt-2 font-bold capitalize tracking-widest">Qidiruv bo'yicha hech narsa topilmadi.</p>
            ) : (
              <p className="text-[9px] md:text-[10px] mt-2 font-bold capitalize tracking-widest">Ushbu filialda administratorlar mavjud emas.</p>
            )}
          </div>
        )}

        {/* Admin Cards List/Grid */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8 max-w-7xl mx-auto">
            {filteredAdmins.map((item, index) => (
              <AdminCard key={index} data={item} viewMode={viewMode} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:gap-4 max-w-7xl mx-auto">
            {filteredAdmins.map((item, index) => (
              <AdminCard key={index} data={item} viewMode={viewMode} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminList;