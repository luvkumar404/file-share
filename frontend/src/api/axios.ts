import axios from "axios";

const api = axios.create({
  timeout: 120000,
  baseURL: import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:8000" : "/api"),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function getApiError(error: unknown, fallback = "Something went wrong.") {
  if (axios.isAxiosError<{ detail?: string }>(error)) {
    const detail = error.response?.data?.detail;
    return typeof detail === "string" ? detail : error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

export default api;
