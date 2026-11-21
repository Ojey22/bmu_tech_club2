/**
 * Shared API origin for local development and the deployed website.
 * A manually supplied window.API_BASE_URL always takes precedence.
 */
(() => {
  if (window.API_BASE_URL) return;

  const hostname = window.location.hostname;
  const isLocalDevelopment = hostname === "localhost" || hostname === "127.0.0.1";

  window.API_BASE_URL = isLocalDevelopment
    ? "http://localhost:5000"
    : "https://bmu-tech-club2.onrender.com";
})();
