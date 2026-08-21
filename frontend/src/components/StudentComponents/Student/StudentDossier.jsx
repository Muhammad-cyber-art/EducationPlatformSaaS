import React from "react";
import {
  Phone,
  FileText,
  Send,
  User,
  ShieldCheck,
  CreditCard,
  Save,
} from "lucide-react";
import { ProfileAttribute } from "./Helpers";

const StudentDossier = ({ studentData, canConfirmPayment, dispatch }) => {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* IDENTIFICATION DOSSIER */}
      <div className="lux-card space-y-6">
        <div className="flex items-center gap-3 px-1">
          <span className="text-[10px] font-bold text-[var(--gold)] capitalize tracking-[0.3em]">
            Shaxsiy ma'lumotlar
          </span>
        </div>
        <div className="space-y-4">
          <ProfileAttribute
            icon={<Phone size={14} />}
            label="Telefon"
            value={studentData?.phone}
            colorClass="text-blue-400 bg-blue-400/10 border border-blue-400/20"
          />
          <ProfileAttribute
            icon={<FileText size={14} />}
            label="Eslatmalar"
            value={studentData?.notes || "Qo'shimcha eslatmalar yo'q"}
          />
          {studentData?.telegram_id && (
            <ProfileAttribute
              icon={<Send size={14} className="text-[#0088cc]" />}
              label="Telegram"
              value={"ULANGAN"}
              colorClass="text-[#0088cc] bg-[#0088cc]/10 border border-[#0088cc]/20"
            />
          )}
        </div>
      </div>

      {/* GUARDIAN DOSSIER */}
      <div className="lux-card space-y-6">
        <div className="flex items-center gap-3 px-1">
          <span className="text-[10px] font-bold text-[var(--gold)] capitalize tracking-[0.3em]">
            Vasiy ma'lumotlari
          </span>
        </div>
        <div className="space-y-4">
          <ProfileAttribute
            icon={<User size={14} />}
            label="F.I.SH"
            value={studentData?.parent_name || "N/A"}
          />
          <ProfileAttribute
            icon={<Phone size={14} />}
            label="Telefon"
            value={studentData?.parent_phone || "N/A"}
            colorClass="text-[var(--gold)] bg-[var(--gold)]/10 border border-[var(--gold)]/20"
          />
          {studentData?.parent_telegram_id ? (
            <ProfileAttribute
              icon={<Send size={14} className="text-[#0088cc]" />}
              label="Telegram"
              value={"ULANGAN"}
              colorClass="text-[#0088cc] bg-[#0088cc]/10 border border-[#0088cc]/20"
            />
          ) : (
            <ProfileAttribute
              icon={<Send size={14} className="opacity-20" />}
              label="Telegram"
              value={"ULANMAGAN"}
            />
          )}
        </div>
      </div>

      {/* FINANCIAL DOSSIER */}
      <div className="lux-card space-y-6">
        <div className="flex items-center gap-3 px-1">
          <span className="text-[10px] font-bold text-[var(--gold)] capitalize tracking-[0.3em]">
            Moliyaviy status
          </span>
        </div>
        <div className="space-y-4">
          <ProfileAttribute
            icon={<ShieldCheck size={14} />}
            label="Holati"
            value={
              studentData?.status === "low_income"
                ? "Kam ta'minlangan"
                : studentData?.status === "discount"
                  ? "Imtiyozli"
                  : studentData?.status === "negotiated"
                    ? "Kelishilgan narx"
                    : studentData?.status === "teacher_negotiated"
                      ? "O'qituvchi kelishgan"
                      : "Oddiy"
            }
          />
          <ProfileAttribute
            icon={<CreditCard size={14} />}
            label="Individual narx"
            value={
              studentData?.custom_fee
                ? `${Number(studentData.custom_fee).toLocaleString()} UZS`
                : "Belgilanmagan"
            }
          />
        </div>
        {/* (O'CHIRILGAN) Qo'shimcha summa kiritish butoni 
        {canConfirmPayment && studentData?.status !== "discount" && (
          <button
            onClick={() =>
              dispatch({ type: "TOGGLE_CUSTOM_PAYMENT", payload: true })
            }
            className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--gold)] text-black text-[10px] font-black capitalize tracking-widest active:scale-95 transition-all shadow-lg"
          >
            <Save size={14} /> Qo'shimcha summa kiritish
          </button>
        )}
        */}
      </div>
    </div>
  );
};

export default StudentDossier;
