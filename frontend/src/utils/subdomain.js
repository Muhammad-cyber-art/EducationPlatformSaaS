/**
 * Subdomain utils for multi-tenant SaaS frontend.
 *
 * Yordamchi funksiyalar:
 * - extractSubdomain: joriy hostname yoki query paramdan tenant subdomenini ajratadi
 * - isTenantSubdomain: joriy sahifa tenant subdomenida turganligini aniqlaydi
 * - getRootPlatformUrl: platforma markaziy URL'iga o'tish uchun havola shakllantiradi
 */

export function extractSubdomain() {
  if (typeof window === "undefined") return "";

  const hostname = window.location.hostname.toLowerCase();

  // 1. URL query param (?subdomain=xxx) fallback (dev va test uchun)
  const urlParams = new URLSearchParams(window.location.search);
  const paramSub = urlParams.get("subdomain");
  if (paramSub) return paramSub.trim().toLowerCase();

  // 2. *.localhost subdomeni (masalan: najot.localhost)
  if (hostname.endsWith(".localhost")) {
    const sub = hostname.replace(/\.localhost$/, "");
    if (sub && !["localhost", "127", "admin", "ceo", "www", "api"].includes(sub)) {
      return sub;
    }
  }

  // 3. Standart domenlar (masalan: najot.crm.uz)
  const parts = hostname.split(".");
  if (parts.length >= 3) {
    const sub = parts[0];
    if (!["www", "api", "admin", "ceo", "mail", "app"].includes(sub)) {
      return sub;
    }
  }

  return "";
}

export function isTenantSubdomain() {
  return Boolean(extractSubdomain());
}

/**
 * Markaziy platforma domeniga URL shakllantirish (CEO panel yoki Root login uchun).
 * Masalan:
 * - najot.localhost:5173 -> http://localhost:5173/ceo/login
 * - najot.crm.uz -> https://crm.uz/ceo/login yoki https://admin.crm.uz/ceo/login
 */
export function getRootPlatformUrl(path = "/ceo/login") {
  if (typeof window === "undefined") return path;

  const hostname = window.location.hostname.toLowerCase();
  const protocol = window.location.protocol;
  const port = window.location.port ? `:${window.location.port}` : "";

  // Localhost muhiti
  if (hostname.endsWith(".localhost") || hostname === "localhost" || hostname === "127.0.0.1") {
    return `${protocol}//localhost${port}${path}`;
  }

  // Production muhiti: subdomenni olib tashlash yoki admin domeniga yo'naltirish
  const parts = hostname.split(".");
  if (parts.length >= 3) {
    const rootDomain = parts.slice(1).join(".");
    return `${protocol}//admin.${rootDomain}${path}`;
  }

  return `${protocol}//${hostname}${port}${path}`;
}
