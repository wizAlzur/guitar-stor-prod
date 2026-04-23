function normalizeBaseUrl(value) {
  const fallback = "http://localhost:8080";
  const url = value || fallback;
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export const APP_ENV = Object.freeze({
  appName: import.meta.env.VITE_APP_NAME || "Six Strings Store",
  apiBaseUrl: normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL),
  siteBase: import.meta.env.VITE_SITE_BASE || "/"
});
