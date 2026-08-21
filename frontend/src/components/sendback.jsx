import { ArrowLeft } from"lucide-react"
import { useNavigate } from'react-router-dom';

export default function GoBackButton() {
 const navigate = useNavigate();

 return (
 <div
 onClick={() => navigate(-1)}
 className='w-10 h-10 md:w-11 md:h-11 bg-[var(--bg-void)] hover:bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl border border-[var(--border-glass)] cursor-pointer transition-all active:scale-90 flex justify-center items-center group shadow-lg shadow-black/20 hover:border-[var(--gold-dim)] backdrop-blur-md'
 >
 <ArrowLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
 </div>
 )
}