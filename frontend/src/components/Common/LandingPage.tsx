import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BellRing,
  Building2,
  CalendarCheck,
  Coins,
  GraduationCap,
  Repeat,
  Send,
  ShieldCheck,
  Sparkles,
  Tags,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import dashboard from "./dashboard-3d.png";
import founder1 from "./muhammad.jpg";
import founder2 from "./aslbek2.jpg";

const spring = { type: "spring" as const, stiffness: 120, damping: 14 };
const pop = { type: "spring" as const, stiffness: 130, damping: 13 };

const roles: { icon: LucideIcon; title: string; tone: string; ring: string; cardTint: string; items: string[] }[] = [
  {
    icon: ShieldCheck,
    title: "Super Admin",
    tone: "text-red-500",
    ring: "from-red-500/25 to-red-500/0",
    cardTint: "bg-red-50/80 border-red-200 shadow-red-500/5",
    items: [
      "Barcha filiallar ustidan to'liq nazorat.",
      "Umumiy Kassa, Utility to'lovlar, xodimlar maoshi.",
      "Imtiyozli (Special) o'quvchilar global arxivi.",
    ],
  },
  {
    icon: Building2,
    title: "Admin / Filial",
    tone: "text-blue-500",
    ring: "from-blue-500/30 to-blue-500/0",
    cardTint: "bg-blue-50/80 border-blue-200 shadow-blue-500/5",
    items: [
      "O'ziga biriktirilgan markaz monitoringi.",
      "Guruhlar va davomatni tekshirish.",
      "Filial xarajatlari (Expenses) va arxivlar.",
    ],
  },
  {
    icon: GraduationCap,
    title: "Mentor / Ustoz",
    tone: "text-emerald-500",
    ring: "from-emerald-500/30 to-emerald-500/0",
    cardTint: "bg-emerald-50/80 border-emerald-200 shadow-emerald-500/5",
    items: [
      "O'z guruhlari ro'yxati va jadvallari.",
      "Talabalar davomatini va vazifalarini baholash.",
      "O'zining maoshini real vaqtda ko'rish.",
    ],
  },
];

const botFeatures = [
  {
    icon: CalendarCheck,
    title: "Elektron Davomat",
    text: "O'qituvchi davomatni belgilashi bilanoq tizim bu ma'lumotni moliya bo'limi (refund uchun) va Telegram botga bir zumda uzatadi.",
  },
  {
    icon: BellRing,
    title: "Avtomatlashgan xabarnoma",
    text: "Oylik to'lovlar vaqti kelganda, qarzdorliklar paydo bo'lganda yoki dars qoldirilganda ota-onalarga bot orqali tezkor eslatmalar boradi.",
  },
];

const botMessages = [
  {
    tag: "Davomat",
    text: "Farzandingiz Aliyev Vali bugungi matematika darsida qatnashmadi.",
    time: "14:32",
  },
  {
    tag: "To'lov",
    text: "Sizning noyabr oyi uchun to'lov qoldig'ingiz 150,000 UZS. Iltimos, belgilangan muddatda to'lovni amalga oshiring.",
    time: "09:10",
  },
];

const financeFeatures = [
  {
    icon: Coins,
    title: "Avtomatik Chegirmalar / Refund",
    text: 'Dars qoldirilsa, pullar kunlik narx asosida hisoblanadi va "Kumulyativ qoldiqsiz" tarzda qayta taqsimlanadi.',
  },
  {
    icon: Tags,
    title: "Individual Narxlar / Custom Fees",
    text: '"Kam ta\'minlangan", "Imtiyozli" va "O\'qituvchi kelishgan" (oylikka ta\'sir qilmaydigan) narx yechimlari mavjud.',
  },
  {
    icon: Repeat,
    title: "Guruhdan o'tish / Transfers",
    text: "O'quvchi guruhdan guruhga o'tganda avvalgi qarzi yoki ortiqcha puli yangi guruhga matematik aniqlikda ko'chiriladi.",
  },
];

const reportRows = [
  { label: "Oylik to'lov", value: "600,000 UZS" },
  { label: "Qoldirilgan darslar (2 kun)", value: "− 60,000 UZS" },
  { label: "Imtiyoz (Special)", value: "− 90,000 UZS" },
  { label: "Oldingi guruh qoldig'i", value: "+ 25,000 UZS" },
];

const founders = [
  {
    img: founder1,
    name: "Muhammad Komilov",
    contact: '@ko_milov_off , tel : +998(93)697-09-26',
    role: "CEO & Founder & Backent developer",
    bio: "Texnologik strategiyalar va arxitektura bo'yicha murakkab moliyaviy algoritmlari yaratuvchisi.",
  },
  {
    img: founder2,
    name: "Aslbek Yusupov",
    contact: '@aslbekyusupov , tel : +998(20)001-58-88',
    role: "CTO & UI/UX designer & Frontent developer",
    bio: "Zamonaviy UI/UX interfeyslari va marketing bo'yicha mutaxassis.",
  },
];

export function LandingPage() {
  return (
    <div data-theme="light" className="min-h-screen bg-[#fdfaf5] text-[#120f0d]">
      {/* Aurora background */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-32 h-[38rem] w-[38rem] rounded-full bg-gold/30 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[34rem] w-[34rem] rounded-full bg-gold-soft/35 blur-[130px]" />
        <div className="absolute bottom-0 left-1/4 h-[30rem] w-[30rem] rounded-full bg-sky/15 blur-[130px]" />
        <div className="absolute inset-0 bg-[#fdfaf5]/40" />
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-50 px-4 pt-4">
        <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-3xl px-5 py-3 backdrop-blur-3xl bg-white/80 border border-black/5 shadow-sm">
          <a href="#hero" className="flex items-center gap-2.5">
            <img src="/yaxshi_niyat_logo.png" alt="Yaxshi Niyat" className="h-12 w-auto object-contain" />
          </a>
          <div className="hidden items-center gap-7 text-sm text-[#827161] md:flex">
            <a className="transition-colors hover:text-[#120f0d]" href="#routerlar">
              Routerlar
            </a>
            <a className="transition-colors hover:text-[#120f0d]" href="#telegram">
              Telegram bot
            </a>
            <a className="transition-colors hover:text-[#120f0d]" href="#moliya">
              Moliya
            </a>
            <a className="transition-colors hover:text-[#120f0d]" href="#asoschilar">
              Asoschilar
            </a>
          </div>
          <Link
            to="/login"
            className="bg-cta-gradient rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-transform hover:scale-[1.04]"
          >
            Tizimga kirish
          </Link>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section id="hero" className="relative px-4 pt-16 pb-24 md:pt-24">
          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <motion.span
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: 0.05 }}
                className="bg-white/90 backdrop-blur-2xl border border-[#967b4f]/15 shadow-md inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold tracking-wide text-[#827161]"
              >
                <Sparkles className="h-3.5 w-3.5 text-gold" />
                Premium Ta'lim Boshqaruvi
              </motion.span>

              <motion.h1
                initial={{ opacity: 0, y: 26 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: 0.12 }}
                className="mt-6 text-4xl leading-[1.05] font-bold md:text-6xl"
              >
                O'quv markazni <span className="text-gold-gradient">yangi bosqichga</span> olib
                chiqing.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: 0.2 }}
                className="mt-6 max-w-xl text-base leading-relaxed text-[#827161] md:text-lg"
              >
                Yaxshi Niyat platformasi — markazning har bir bo'g'inini mukammal nazorat qiluvchi,
                o'qituvchilar, adminlar va moliyaviy hisobotlarni bir joyda jamlagan raqamli
                ekotizim.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: 0.28 }}
                className="mt-9"
              >
                <Link to="/login" className="inline-block">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 400, damping: 12 }}
                    className="bg-cta-gradient inline-flex items-center gap-2 rounded-full px-7 py-4 text-sm font-semibold text-white shadow-float"
                  >
                    Boshlash / Tizimga kirish
                    <ArrowRight className="h-4 w-4" />
                  </motion.div>
                </Link>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.92, rotate: -2 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 90, damping: 13, delay: 0.15 }}
              className="relative"
            >
              <motion.img
                src={dashboard}
                alt="Yaxshi Niyat platformasining 3D boshqaruv paneli maketi"
                width={1200}
                height={1008}
                animate={{ y: [0, -18, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="w-full drop-shadow-[0_40px_70px_rgba(200,150,20,0.25)]"
              />
            </motion.div>
          </div>
        </section>

        {/* Routers */}
        <section id="routerlar" className="px-4 py-24">
          <div className="mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ type: "spring", stiffness: 110, damping: 15 }}
              className="max-w-2xl"
            >
              <h2 className="text-3xl font-bold md:text-5xl">Kuchli va himoyalangan routerlar</h2>
              <p className="mt-5 text-[#827161] md:text-lg">
                Har bir xodim faqat o'ziga tegishli vazifalarni bajaradi. Rolga asoslangan routerlar
                ma'lumotlar xavfsizligini 100% ta'minlaydi.
              </p>
            </motion.div>

            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {roles.map((role, i) => (
                <motion.article
                  key={role.title}
                  initial={{ opacity: 0, y: 40, scale: 0.96 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ ...pop, delay: i * 0.1 }}
                  whileHover={{ y: -10 }}
                  className={`relative overflow-hidden rounded-[2.5rem] p-7 backdrop-blur-2xl border shadow-xl ${role.cardTint}`}
                >
                  <div
                    className={`absolute -top-20 -right-16 h-44 w-44 rounded-full bg-gradient-to-br blur-2xl ${role.ring}`}
                  />
                  <span
                    className={`relative flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fdfaf5]/80 ${role.tone}`}
                  >
                    <role.icon className="h-6 w-6" />
                  </span>
                  <h3 className="relative mt-6 text-xl font-semibold">{role.title}</h3>
                  <ul className="relative mt-5 space-y-3.5 text-sm leading-relaxed text-[#827161]">
                    {role.items.map((item) => (
                      <li key={item} className="flex gap-3">
                        <span
                          className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current ${role.tone}`}
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* Telegram bot — sticky mockup */}
        <section id="telegram" className="px-4 py-24">
          <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-2">
            <div className="lg:sticky lg:top-28 lg:h-fit">
              <div className="bg-white/90 backdrop-blur-2xl border border-[#967b4f]/15 shadow-md rounded-[2.5rem] p-5">
                <div className="flex items-center gap-3 border-b border-border/60 pb-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/20 text-gold">
                    <Send className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Yaxshi Niyat Bot</p>
                    <p className="text-xs text-success">online</p>
                  </div>
                </div>
                <div className="mt-5 space-y-4">
                  {botMessages.map((m, i) => (
                    <motion.div
                      key={m.tag}
                      initial={{ opacity: 0, x: -24, scale: 0.95 }}
                      whileInView={{ opacity: 1, x: 0, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{
                        type: "spring",
                        stiffness: 160,
                        damping: 14,
                        delay: 0.15 + i * 0.15,
                      }}
                      className="rounded-3xl rounded-bl-lg bg-[#fdfaf5]/85 p-4 shadow-soft"
                    >
                      <span className="text-[11px] font-semibold tracking-wide text-gold uppercase">
                        {m.tag}
                      </span>
                      <p className="mt-2 text-sm leading-relaxed text-[#120f0d]/90">{m.text}</p>
                      <p className="mt-2 text-right text-[11px] text-[#827161]">{m.time}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:py-8">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ type: "spring", stiffness: 110, damping: 15 }}
              >
                <span className="bg-white/90 backdrop-blur-2xl border border-[#967b4f]/15 shadow-md inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-[#827161]">
                  <Zap className="h-3.5 w-3.5 text-gold" />
                  Avtomatizatsiya &amp; Telegram Bot
                </span>
                <h2 className="mt-6 text-3xl font-bold md:text-4xl">
                  Ta'limni nazorat qilish hech qachon bunchalik shaffof bo'lmagan.
                </h2>
                <p className="mt-5 text-[#827161] md:text-lg">
                  Ota-onalar farzandlarining har bir qadamidan, darsdagi faolligidan va to'lov
                  xarajatlaridan real vaqtda xabardor bo'lib turishadi.
                </p>
              </motion.div>

              <div className="mt-10 space-y-6">
                {botFeatures.map((f, i) => (
                  <motion.div
                    key={f.title}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ ...pop, damping: 14, delay: i * 0.08 }}
                    className="bg-white/70 backdrop-blur-xl border border-[#967b4f]/25 shadow-sm rounded-[2rem] p-7"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fdfaf5]/80 text-gold">
                      <f.icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-[#827161]">{f.text}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Finance — sticky report */}
        <section id="moliya" className="px-4 py-24">
          <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-2">
            <div className="lg:py-8">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ type: "spring", stiffness: 110, damping: 15 }}
              >
                <h2 className="text-3xl font-bold md:text-4xl">
                  Murakkab moliyaviy muammolarga{" "}
                  <span className="text-gold-gradient">aqlli yechimlar</span>.
                </h2>
                <p className="mt-5 text-[#827161] md:text-lg">
                  Bizning moliya va hisob-kitob modulimiz oddiy tizimlardan farqli o'laroq, hayotda
                  uchrashadigan har qanday "noaniq" moliyaviy holatlarni hisobga oladi.
                </p>
              </motion.div>

              <div className="mt-10 space-y-6">
                {financeFeatures.map((f, i) => (
                  <motion.div
                    key={f.title}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ ...pop, damping: 14, delay: i * 0.08 }}
                    className="bg-white/70 backdrop-blur-xl border border-[#967b4f]/25 shadow-sm rounded-[2rem] p-7"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fdfaf5]/80 text-gold">
                      <f.icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-[#827161]">{f.text}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="lg:sticky lg:top-28 lg:h-fit">
              <div className="bg-white/90 backdrop-blur-2xl border border-[#967b4f]/15 shadow-md rounded-[2.5rem] p-7">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Hisobot Namuna</p>
                  <span className="rounded-full bg-gold/25 px-3 py-1 text-[11px] font-semibold text-[#120f0d]/70">
                    Noyabr
                  </span>
                </div>
                <div className="mt-6 space-y-4">
                  {reportRows.map((r, i) => (
                    <motion.div
                      key={r.label}
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ type: "spring", stiffness: 160, damping: 15, delay: i * 0.08 }}
                      className="flex items-center justify-between border-b border-border/60 pb-3 text-sm"
                    >
                      <span className="text-[#827161]">{r.label}</span>
                      <span className="font-semibold">{r.value}</span>
                    </motion.div>
                  ))}
                </div>
                <div className="bg-aurora mt-6 flex items-center justify-between rounded-3xl px-5 py-4">
                  <span className="text-sm font-medium">Yakuniy summa</span>
                  <span className="font-display text-xl font-bold">475,000 UZS</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Founders */}
        <section id="asoschilar" className="px-4 py-24">
          <div className="mx-auto max-w-5xl">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ type: "spring", stiffness: 110, damping: 15 }}
              className="max-w-2xl"
            >
              <h2 className="text-3xl font-bold md:text-5xl">Loyihamiz Asoschilari</h2>
              <p className="mt-5 text-[#827161] md:text-lg">
                Tizimni eng yuksak standartlarda yaratgan va raqamli ta'lim kelajagini shakllantirgan
                yetakchi mutaxassislar.
              </p>
            </motion.div>

            <div className="mt-14 grid gap-8 sm:grid-cols-2">
              {founders.map((f, i) => (
                <motion.article
                  key={f.name}
                  initial={{ opacity: 0, y: 44, scale: 0.96 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ ...pop, delay: i * 0.12 }}
                  whileHover={{ y: -8 }}
                  className="bg-white/90 backdrop-blur-2xl border border-[#967b4f]/15 shadow-md overflow-hidden rounded-[2.5rem] p-8 flex flex-col items-center text-center"
                >
                  <div className="relative mb-6 rounded-full p-1.5 bg-gradient-to-tr from-[#967b4f] to-[#e4d4b8] shadow-[0_15px_30px_rgba(150,123,79,0.25)]">
                    <img
                      src={f.img}
                      alt={`${f.name} — ${f.role}`}
                      loading="lazy"
                      className="relative h-36 w-36 rounded-full object-cover border-[5px] border-white"
                    />
                  </div>
                  <div className="mt-6 text-center">
                    <h3 className="text-2xl font-bold">{f.name}</h3>
                    <p className="mt-1.5 text-sm font-semibold tracking-wide text-gold uppercase">{f.role}</p>
                    <p className="mt-4 text-sm leading-relaxed text-[#827161]">{f.bio}</p>
                    <p className="mt-4 text-sm text-gray-500">
                      <b> {f.contact.split(',')[0].trim()} • {f.contact.split(',')[1].trim()}</b>
                    </p>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="px-4 pb-10">
        <div className="bg-white/90 backdrop-blur-2xl border border-[#967b4f]/15 shadow-md mx-auto flex max-w-6xl flex-col items-center gap-4 rounded-4xl px-8 py-10 text-center">
          <div className="flex items-center gap-2.5">
            <img src="/yaxshi_niyat_logo.png" alt="Yaxshi Niyat" className="h-10 w-auto object-contain" />
          </div>
          <p className="text-sm text-[#827161]">
            © {new Date().getFullYear()} Yaxshi Niyat Educational Platform. Barcha huquqlar
            himoyalangan.
          </p>
        </div>
      </footer>
    </div>
  );
}
