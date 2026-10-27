import axios from "axios";
import { jwtDecode } from "jwt-decode";
import notify from "../utils/toastNotify";

/**
 * Sozlamalar:
 * - BASE_URL ni o'zgartiring agar kerak bo'lsa
 * - REFRESH_ENDPOINT backenddagi refresh endpointga moslashtiring
 */
// Dinamik BASE_URL sozlash: barcha subdomenlar (masalan: najot.crm.uz, app.crm.uz) va *.localhost uchun
const getBaseUrl = () => {
  const hostname = window.location.hostname;

  // Local development (localhost, 127.0.0.1, yoki istalgan *.localhost subdomeni)
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost")) {
    return "http://127.0.0.1:8000/api/";
  }

  // Production / Staging: so'rov kelgan aniq domen/subdomen bo'yicha dinamik yo'naltirish
  return `${window.location.protocol}//${window.location.host}/api/`;
};

const BASE_URL = getBaseUrl();
const REFRESH_ENDPOINT = "refresh/";

// BUG FIX: Production da API URL ni console ga chiqarmaslik (xavfsizlik)
if (import.meta.env.DEV) {
  console.log("API Base URL:", BASE_URL);
}

// Asosiy api client (barcha so'rovlar shu orqali ketadi)
// 25 soniya timeout: sekinroq mobil tarmoq (3G/4G) va analitika so'rovlarida asossiz timeout xatoliklarini oldini oladi
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 25000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Alohida client refresh so'rovi uchun (interceptorlarga tushmasin)
const refreshClient = axios.create({
  baseURL: BASE_URL,
  timeout: 25000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Headerlarni sozlovchi yordamchi funksiya
function applyTenantHeaders(headers) {
  if (!headers) return;
  const hostname = window.location.hostname;

  // 1. Agar brauzer subdomenda turgan bo'lsa (masalan: najot.localhost yoki najot.crm.uz)
  if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
    headers["X-Tenant-Domain"] = hostname;
  }

  // 2. Local dev uchun query param yoki saqlangan subdomen/schema
  const urlParams = new URLSearchParams(window.location.search);
  const subParam = urlParams.get("subdomain");
  if (subParam) {
    headers["X-Tenant-Domain"] = `${subParam}.localhost`;
    headers["X-Tenant-Subdomain"] = subParam;
  }

  const tenantSchema = localStorage.getItem("tenant_schema");
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost");
  if (tenantSchema && isLocal) {
    headers["X-Tenant-Schema"] = tenantSchema;
  }
}

// Local dev uchun refreshClient'ga ham headerlarni uzatish
refreshClient.interceptors.request.use((config) => {
  applyTenantHeaders(config.headers);
  return config;
});

// =====================
// Token helpers
// =====================
function getAccessToken() {
 return localStorage.getItem("access_token");
}

function getRefreshToken() {
 return localStorage.getItem("refresh_token");
}

function setAccessToken(token) {
 localStorage.setItem("access_token", token);
}

function setRefreshToken(token) {
 localStorage.setItem("refresh_token", token);
}

function clearTokensAndLogout() {
 localStorage.removeItem("access_token");
 localStorage.removeItem("refresh_token");
 // Global event — routing/auth context eshitib redirect qilishi mumkin
 window.dispatchEvent(new Event("logout"));
}


// JWT access token muddati tugaganini tekshiruvchi helper
export function isAccessTokenExpired() {
 const token = getAccessToken();
 if (!token) return true;

 try {
 const decoded = jwtDecode(token);
 return decoded.exp * 1000 < Date.now();
 } catch {
 return true;
 }
}

// =====================
// Request interceptor (Local-First Offline Fast-Fail)
// =====================
api.interceptors.request.use(
 (config) => {
   // Oflayn holatda: tarmoq so'rovini kutmasdan darhol reject qilamiz (0ms delay!)
   // Natijada Dexie / IndexedDB keshidan bir zumda (0 soniyada) ma'lumot olinadi
   if (typeof navigator !== 'undefined' && !navigator.onLine) {
     const error = new Error('Tarmoq aloqasi mavjud emas (offline)');
     error.code = 'ERR_NETWORK';
     error.isOffline = true;
     return Promise.reject(error);
   }

   // BUG FIX: Fayl yoki FormData yuborilayotganda Content-Type ni o'chiramiz.
   // Axios / Brauzer o'zi avtomatik to'g'ri 'multipart/form-data; boundary=----...' ni o'rnatishi kerak.
   // Aks holda Django REST Framework MultiPartParser boundary topolmay 400 xato qaytaradi.
   // Shuningdek, sekin tarmoqda katta fayllar (25MB gacha) timeout bo'lmasligi uchun timeoutni 120 soniyaga uzaytiramiz.
   if (config.data instanceof FormData) {
     if (config.headers) {
       delete config.headers['Content-Type'];
     }
     if (!config.timeout || config.timeout === 15000 || config.timeout === 25000) {
       config.timeout = 120000; // 2 daqiqa
     }
   }

   const token = getAccessToken();
   if (token && config && config.headers) {
     config.headers.Authorization = `Bearer ${token}`;
   }
   applyTenantHeaders(config.headers);
   return config;
 },
 (error) => Promise.reject(error)
);

// =====================
// Response interceptor (refresh queue)
// =====================
let isRefreshing = false;
let refreshSubscribers = []; // [{ resolve, reject }]

function onRefreshed(newToken) {
 refreshSubscribers.forEach((cb) => cb.resolve(newToken));
 refreshSubscribers = [];
}

function onRefreshFailed(err) {
 refreshSubscribers.forEach((cb) => cb.reject(err));
 refreshSubscribers = [];
}

// Queue ga promise qo‘shish
function addRefreshSubscriber() {
 return new Promise((resolve, reject) => {
 refreshSubscribers.push({ resolve, reject });
 });
}

api.interceptors.response.use(
 (response) => response,
 async (error) => {
 const originalRequest = error.config;

 if (!originalRequest) return Promise.reject(error);

 // Refresh endpoint bo‘lsa — loopni to‘xtatamiz
 const isRefreshCall = originalRequest.url?.includes(REFRESH_ENDPOINT);
 if (isRefreshCall) {
 clearTokensAndLogout();
 return Promise.reject(error);
 }

 const status = error.response?.status;

 // 401 yoki token bilan bog‘liq 403 larni auth error deb hisoblaymiz
 const isAuthError =
 status === 401 ||
 (status === 403 &&
 error.response?.data?.detail
 ?.toLowerCase()
 ?.includes("token"));

 if (isAuthError && !originalRequest._retry) {
 originalRequest._retry = true;

 // Agar hozir refresh ketayotgan bo‘lsa — queue ga qo‘shamiz
 if (isRefreshing) {
 try {
 const newToken = await addRefreshSubscriber();
 originalRequest.headers.Authorization = `Bearer ${newToken}`;
 return api(originalRequest);
 } catch (err) {
 return Promise.reject(err);
 }
 }

 // Refreshni boshlaymiz
 isRefreshing = true;
 try {
 const refreshToken = getRefreshToken();
 if (!refreshToken) {
 throw new Error("No refresh token available");
 }

 const res = await refreshClient.post(REFRESH_ENDPOINT, {
 refresh: refreshToken,
 });

 const newAccessToken = res.data?.access;
 const newRefreshToken = res.data?.refresh;

 if (!newAccessToken) {
 throw new Error("No access token in refresh response");
 }

 setAccessToken(newAccessToken);
 if (newRefreshToken) {
 setRefreshToken(newRefreshToken);
 }

 onRefreshed(newAccessToken);

 isRefreshing = false;

 originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
 return api(originalRequest);
 } catch (refreshError) {
 isRefreshing = false;
 onRefreshFailed(refreshError);

 const isNetworkError =
 !refreshError.response ||
 refreshError.code === "ERR_NETWORK" ||
 refreshError.code === "ECONNABORTED";

 if (!isNetworkError) {
 clearTokensAndLogout();
 }
 return Promise.reject(refreshError);
 }
 }

  // --- SMART ERROR HANDLING ---
  // Arzimagan yoki vaqtinchalik xatolarda (401 auth refresh, 429 rate limit, 503 busy, network reconnect)
  // qizil error emas, muloyim kutish yoki ogohlantirish ko'rsatiladi
  notify.apiError(error);


 return Promise.reject(error);
 }
);

export default api;
