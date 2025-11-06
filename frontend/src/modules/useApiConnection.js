import { useEffect, useMemo, useState } from "react";
import {
  DISABLE_AUTH,
  buildAuthHeaders,
  buildEndpoint,
  getDefaultApiUrl,
  getStoredApiUrl,
  getStoredToken,
  normalizeToken,
} from "./apiConfig";

const readApiUrl = () => getStoredApiUrl() || getDefaultApiUrl();
const readToken = () => getStoredToken() || "";

export const useApiConnection = () => {
  const [apiUrl, setApiUrl] = useState(() => readApiUrl());
  const [token, setToken] = useState(() => readToken());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleStorage = (event) => {
      if (!event || !event.key) {
        setApiUrl(readApiUrl());
        setToken(readToken());
        return;
      }
      if (event.key === "dof_api_url") {
        setApiUrl(event.newValue || getDefaultApiUrl());
      }
      if (event.key === "dof_token") {
        setToken(event.newValue || "");
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const endpoint = useMemo(() => buildEndpoint(apiUrl), [apiUrl]);
  const normalizedToken = useMemo(() => normalizeToken(token), [token]);
  const headers = useMemo(
    () => buildAuthHeaders(normalizedToken),
    [normalizedToken]
  );

  const ready = useMemo(() => {
    if (!endpoint) {
      return false;
    }
    if (DISABLE_AUTH) {
      return true;
    }
    return Boolean(normalizedToken);
  }, [endpoint, normalizedToken]);

  return {
    apiUrl: endpoint,
    token: normalizedToken,
    headers,
    isReady: ready,
    authDisabled: DISABLE_AUTH,
    refresh: () => {
      setApiUrl(readApiUrl());
      setToken(readToken());
    },
  };
};
