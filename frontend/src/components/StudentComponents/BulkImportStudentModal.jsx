import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, FileSpreadsheet, Loader2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../../tokenUpdater/updater";

const phoneValue = (value) => {
  const text = String(value ?? "").trim();
  return /^(?:[-–—]+|x+)$/i.test(text) ? "" : text;
};

function ImportSession({ onClose, branchId, groupId, groups = [], onSuccess }) {
  const queryClient = useQueryClient();
  const fileInput = useRef(null);
  const cameraInput = useRef(null);
  const busy = useRef(false);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(String(groupId || ""));
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState(null);
  const [target, setTarget] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!file?.type.startsWith("image/")) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (!loading) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [loading]);

  const availableGroups = groups.filter((group) => {
    const id = group.branch_id ?? group.branch?.id ?? group.branch;
    return !group.is_archived && group.is_faol !== false && (!branchId || String(id) === String(branchId));
  });
  const selectFile = (event) => {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected || busy.current) return;
    if (!/\.(xlsx|csv|png|jpe?g|webp|bmp)$/i.test(selected.name)) {
      toast.error(".xlsx, .csv yoki PNG/JPG/WEBP/BMP rasm tanlang. .xls faylni .xlsx qilib saqlang."); return;
    }
    if (!selected.size || selected.size > 10 * 1024 * 1024) {
      toast.error("Fayl bo‘sh bo‘lmasligi va 10 MB dan oshmasligi kerak."); return;
    }
    setFile(selected); setRows(null); setResult(null); setError("");
  };
  const submit = async (confirm = false) => {
    if (busy.current || (confirm ? !rows?.length : !file)) return;
    busy.current = true; setLoading(true); setError("");
    try {
      let data;
      if (confirm) {
        data = { mode: "confirm", students: rows.map((row) => ({ ...row, phone: phoneValue(row.phone), parent_phone: phoneValue(row.parent_phone) })), branch_id: target.branch_id, group_id: target.group_id };
      } else {
        data = new FormData(); data.append("file", file); data.append("mode", "preview");
        if (branchId) data.append("branch_id", branchId);
        if (selectedGroup) data.append("group_id", selectedGroup);
      }
      const response = await api.post("/groups/students/import-file/", data, {
        timeout: 120000,
        headers: { "Content-Type": confirm ? "application/json" : "multipart/form-data" },
      });
      if (!confirm) {
        setRows(response.data.students.map((row) => ({ ...row, phone: phoneValue(row.phone || row.raw_phone), parent_phone: phoneValue(row.parent_phone || row.raw_parent_phone) })));
        setTarget({ branch_id: response.data.branch_id, group_id: response.data.group_id });
      } else {
        const outcome = response.data; setResult(outcome);
        if (outcome.success) {
          for (const key of ["students", "group-students", "nested-groups", "group-detail", "groups", "global-students"]) {
            queryClient.invalidateQueries({ queryKey: [key] });
          }
          toast.success(outcome.message); onSuccess?.(outcome);
        }
      }
    } catch (err) {
      const body = err.response?.data;
      const message = body?.error || body?.detail || body?.message ||
        (confirm ? "Server javobi olinmadi. Guruhni tekshiring; qayta yuborish mavjud yozuvlarni takrorlamaydi." : "Faylni o‘qib bo‘lmadi. Ulanish va faylni tekshiring.");
      setError(typeof message === "string" ? message : JSON.stringify(message));
    } finally { busy.current = false; setLoading(false); }
  };
  const reset = () => { setFile(null); setRows(null); setResult(null); setError(""); setTarget(null); };
  const updateRow = (index, field, value) => setRows((items) => items.map((item, i) => i === index ? { ...item, [field]: value } : item));
  const retryFailed = () => {
    setRows(result.failed_students.map((row) => ({ row: row.row, full_name: row.name, phone: phoneValue(row.phone), parent_phone: phoneValue(row.parent_phone) })));
    setResult(null); setError("");
  };
  const inputClass = "w-full bg-slate-800 border border-white/20 rounded-lg p-2 text-sm text-white";
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 overscroll-contain">
      <section role="dialog" aria-modal="true" aria-labelledby="student-import-title" className="w-full max-w-3xl bg-slate-900 text-white rounded-2xl flex flex-col max-h-[calc(100dvh-2rem)] overflow-hidden">
        <header className="shrink-0 p-5 border-b border-white/10 flex justify-between items-center">
          <h2 id="student-import-title" className="font-bold">Rasm yoki Excel orqali o‘quvchi qo‘shish</h2>
          <button type="button" disabled={loading} onClick={onClose} aria-label="Yopish" className="disabled:opacity-40"><X /></button>
        </header>
        <div className="min-h-0 p-5 overflow-auto overscroll-contain space-y-4">
          {error && <p role="alert" className="text-rose-300">{error}</p>}
          {result ? <>
            <p role="status" className={result.success ? "text-emerald-300" : "text-rose-300"}>{result.message}</p>
            <p>Yangi: {result.created_count} · Mavjud: {result.existing_count} · Xato: {result.failed_count}</p>
            {result.created_students?.map((student, i) => <p key={`${student.id}-${i}`} className="text-sm text-emerald-200">{student.full_name} — {student.phone}</p>)}
            {result.failed_students?.map((row, i) => <div key={i} className="p-3 bg-rose-500/10 rounded-lg text-sm">
              <p>{row.row}-qator: {row.name} ({row.phone})</p><p className="text-rose-300">{row.reason}</p>
            </div>)}
          </> : rows ? <>
            <p>Topildi: {rows.length} ta. Ism va telefonlarni tekshiring, xatolarini tuzating. Hozircha hech narsa saqlanmadi.</p>
            <p className="text-sm text-amber-200">{target.group_id ? "Tanlangan guruhga qo‘shiladi. Joriy oy uchun to‘lov varaqasi ham yaratiladi." : "Faqat filialga qo‘shiladi; guruhga biriktirilmaydi."}</p>
            <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left"><thead><tr><th>Qator</th><th>Ism-familiya</th><th>Telefon</th><th>Ota-ona telefoni</th><th /></tr></thead>
              <tbody>{rows.map((row, index) => <tr key={index}>
                <td className="pr-2">{row.row}</td>
                <td className="p-1"><input aria-label={`${index + 1}-o‘quvchi ismi`} className={inputClass} maxLength={200} value={row.full_name} disabled={loading} onChange={(e) => updateRow(index, "full_name", e.target.value)} /></td>
                <td className="p-1"><input aria-label={`${index + 1}-o‘quvchi telefoni`} className={inputClass} type="tel" placeholder="xxxxxx" maxLength={30} value={row.phone || ""} disabled={loading} onChange={(e) => updateRow(index, "phone", e.target.value)} /></td>
                <td className="p-1"><input aria-label={`${index + 1}-o‘quvchi ota-ona telefoni`} className={inputClass} type="tel" placeholder="xxxxxx" maxLength={30} value={row.parent_phone || ""} disabled={loading} onChange={(e) => updateRow(index, "parent_phone", e.target.value)} /></td>
                <td><button type="button" disabled={loading} aria-label={`${index + 1}-qatorni olib tashlash`} onClick={() => setRows((items) => items.filter((_, i) => i !== index))}><X size={18} /></button></td>
              </tr>)}</tbody></table></div>
          </> : <>
            {groupId ? <p>Guruh: {groups.find((g) => String(g.id) === String(groupId))?.name || `#${groupId}`}</p> : <label className="block">Guruhga biriktirish
              <select className={inputClass} value={selectedGroup} disabled={loading} onChange={(e) => setSelectedGroup(e.target.value)}>
                <option value="">Faqat filialga qo‘shish</option>
                {availableGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select></label>}
            <div className="flex gap-3 flex-wrap">
              <button type="button" className="lux-btn" disabled={loading} onClick={() => fileInput.current?.click()}><FileSpreadsheet size={18} /> Fayl tanlash</button>
              <button type="button" className="lux-btn" disabled={loading} onClick={() => cameraInput.current?.click()}><Camera size={18} /> Kameradan olish</button>
            </div>
            <input ref={fileInput} type="file" accept=".xlsx,.csv,.png,.jpg,.jpeg,.webp,.bmp" onChange={selectFile} className="hidden" />
            <input ref={cameraInput} type="file" accept="image/*" capture="environment" onChange={selectFile} className="hidden" />
            {file && <p className="break-all">{file.name} ({Math.ceil(file.size / 1024)} KB)</p>}
            {previewUrl && <img src={previewUrl} alt="Tanlangan o‘quvchilar ro‘yxati" className="max-h-64 mx-auto rounded-lg" />}
            <p className="text-sm text-slate-300">Excel/CSV va rasmdagi ustunlar avtomatik aniqlanadi. Sarlavha bo‘lmasa, ikkinchi qatordagi 10 tadan ko‘p harfli ma’lumot ism-familiya deb olinadi. Birinchi telefon ustuni o‘quvchiga, ikkinchisi ota-onaga tegishli. Qisqa tartib raqamlari telefon hisoblanmaydi. Ko‘pi bilan 500 o‘quvchi, 10 MB.</p>
            <p className="text-sm text-slate-300">Rasmda har bir qatorda ism-familiya va telefon bo‘lsin. Surat tiniq, jadval to‘g‘ri tushgan bo‘lishi kerak. O‘qilgan ma’lumotni keyingi bosqichda tuzatasiz.</p>
          </>}
        </div>
        <footer className="shrink-0 p-5 border-t border-white/10 flex gap-3 justify-end flex-wrap">
          {loading ? <p role="status" className="flex gap-2"><Loader2 className="animate-spin" /> {rows ? "Saqlanmoqda..." : "Fayl o‘qilmoqda..."}</p> : result ? <>
            {!!result.failed_count && <button type="button" className="lux-btn" onClick={retryFailed}>Xato qatorlarni tuzatish</button>}
            <button type="button" className="lux-btn" onClick={reset}>Yangi fayl</button>
            <button type="button" className="lux-btn lux-btn-primary" onClick={onClose}>Tugatish</button>
          </> : <>
            {rows && <button type="button" className="lux-btn" onClick={reset}>Boshqa fayl</button>}
            <button type="button" className="lux-btn" onClick={onClose}>Bekor qilish</button>
            <button type="button" className="lux-btn lux-btn-primary disabled:opacity-40" disabled={rows ? !rows.length : !file} onClick={() => submit(!!rows)}>{rows ? "Tasdiqlash va saqlash" : "O‘qish va tekshirish"}</button>
          </>}
        </footer>
      </section>
    </div>
  );
}

export default function BulkImportStudentModal({ isOpen, ...props }) {
  // Keep the fixed overlay outside animated/transformed page containers.
  return isOpen ? createPortal(
    <ImportSession key={`${props.branchId || ""}:${props.groupId || ""}`} {...props} />,
    document.body,
  ) : null;
}
