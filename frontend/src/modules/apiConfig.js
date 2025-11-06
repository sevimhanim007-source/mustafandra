const parseBoolean = (value) => String(value ?? "false").toLowerCase() === "true";

const importMetaEnv = typeof import.meta !== "undefined" ? import.meta.env ?? {} : {};
const processEnv =
  typeof process !== "undefined" && process.env ? process.env : {};

const resolveBackendBase = () => {
  const envValue =
    importMetaEnv.VITE_BACKEND_URL ||
    processEnv.REACT_APP_BACKEND_URL ||
    "http://localhost:8001";
  return envValue.replace(/\s+/g, "").replace(/\/$/, "");
};

const backendBase = resolveBackendBase();

export const getDefaultApiUrl = () => `${backendBase}/api`;

export const STORAGE_KEYS = {
  api: "dof_api_url",
  token: "dof_token",
};

const hasStorage = typeof window !== "undefined" && window.localStorage;

export const getStoredApiUrl = () =>
  hasStorage ? window.localStorage.getItem(STORAGE_KEYS.api) : null;

export const getStoredToken = () =>
  hasStorage ? window.localStorage.getItem(STORAGE_KEYS.token) : null;

export const getInitialApiUrl = () => getStoredApiUrl() || getDefaultApiUrl();

export const getInitialToken = () => getStoredToken() || "";

export const setStoredApiUrl = (value) => {
  if (hasStorage) {
    window.localStorage.setItem(STORAGE_KEYS.api, value);
  }
};

export const setStoredToken = (value) => {
  if (hasStorage) {
    window.localStorage.setItem(STORAGE_KEYS.token, value);
  }
};

export const saveConnection = (apiUrl, token) => {
  setStoredApiUrl(apiUrl);
  setStoredToken(token);
};

export const normalizeApiUrl = (value) => {
  if (!value) {
    return getDefaultApiUrl();
  }
  return value.replace(/\s+/g, "").replace(/\/$/, "");
};

export const normalizeToken = (value) => (value ?? "").trim();

export const buildEndpoint = (value) => normalizeApiUrl(value);

export const DISABLE_AUTH = parseBoolean(
  importMetaEnv.VITE_DISABLE_AUTH ?? processEnv.REACT_APP_DISABLE_AUTH
);

const autoLoginRaw =
  importMetaEnv.VITE_AUTO_LOGIN ?? processEnv.REACT_APP_AUTO_LOGIN;

export const AUTO_LOGIN = {
  enabled: !DISABLE_AUTH && parseBoolean(autoLoginRaw),
  username:
    importMetaEnv.VITE_AUTO_LOGIN_USERNAME ??
    processEnv.REACT_APP_AUTO_LOGIN_USERNAME ??
    "",
  password:
    importMetaEnv.VITE_AUTO_LOGIN_PASSWORD ??
    processEnv.REACT_APP_AUTO_LOGIN_PASSWORD ??
    "",
};

export const buildAuthHeaders = (token) => {
  if (DISABLE_AUTH) {
    return {};
  }
  const normalized = normalizeToken(token);
  return normalized ? { Authorization: `Bearer ${normalized}` } : {};
};
