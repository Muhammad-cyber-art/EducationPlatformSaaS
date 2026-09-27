import axios from"axios";
import toast from"react-hot-toast";
import { jwtDecode } from"jwt-decode";

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

// Debug: log the base URL to make sure it's correct
console.log("API Base URL:", BASE_URL);

// Asosiy api client (barcha so'rovlar shu orqali ketadi)
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000, // 30 soniya timeout
  headers: {
    "Content-Type": "application/json",
  },
});

// Alohida client refresh so'rovi uchun (interceptorlarga tushmasin)
const refreshClient = axios.create({
  baseURL: BASE_URL,
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
// Request interceptor
// =====================
api.interceptors.request.use(
 (config) => {
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
 clearTokensAndLogout();
 return Promise.reject(refreshError);
 }
 }

 // --- GLOBAL ERROR HANDLING ---
 // Faqat 401 bo'lmagan xatolarni toast qilamiz (401 yuqorida handle qilingan)
 if (status >= 400 && status !== 401) {
 const message = error.response?.data?.detail ||
 error.response?.data?.message ||
"Tizimda kutilmagan xatolik yuz berdi";

 // Faqat bitta toast chiqishi uchun (agar ko'p parallel so'rovlar bo'lsa)
 toast.error(message, {
 id:'global-api-error',
 });
 }

 return Promise.reject(error);
 }
);

export default api;
