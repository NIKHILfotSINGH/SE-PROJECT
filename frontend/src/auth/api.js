import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const api = axios.create({ baseURL: API_BASE, withCredentials: false });

const tokenStore = {
  get access() {
    return localStorage.getItem("access");
  },
  set access(val) {
    if (val) localStorage.setItem("access", val);
    else localStorage.removeItem("access");
  },
  get refresh() {
    return localStorage.getItem("refresh");
  },
  set refresh(val) {
    if (val) localStorage.setItem("refresh", val);
    else localStorage.removeItem("refresh");
  },
  setUser({ username, role }) {
    if (username) localStorage.setItem("username", username);
    if (role) localStorage.setItem("role", role);
  },
  clear() {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
  },
};

api.interceptors.request.use((config) => {
  const token = tokenStore.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let refreshPromise = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    if (!response || response.status !== 401 || config._retry) {
      throw error;
    }

    if (!tokenStore.refresh) {
      tokenStore.clear();
      throw error;
    }

    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshToken()
        .then((newAccess) => {
          tokenStore.access = newAccess;
          isRefreshing = false;
          return newAccess;
        })
        .catch((err) => {
          isRefreshing = false;
          tokenStore.clear();
          throw err;
        });
    }

    try {
      const newAccess = await refreshPromise;
      config._retry = true;
      config.headers.Authorization = `Bearer ${newAccess}`;
      return api(config);
    } catch (err) {
      throw err;
    }
  }
);

export async function login(username, password) {
  const { data } = await api.post("/api/auth/login/", { username, password });
  tokenStore.access = data.access;
  tokenStore.refresh = data.refresh;
  tokenStore.setUser({ username: data.username, role: data.role });
  return data;
}

export async function register(username, password, role) {
  const { data } = await api.post("/api/auth/register/", { username, password, role });
  return data;
}

export async function refreshToken() {
  const refresh = tokenStore.refresh;
  if (!refresh) throw new Error("No refresh token available");
  const { data } = await api.post("/api/auth/refresh/", { refresh });
  tokenStore.access = data.access;
  return data.access;
}

export function logout() {
  tokenStore.clear();
}

export function getStoredSession() {
  const access = tokenStore.access;
  const refresh = tokenStore.refresh;
  const role = localStorage.getItem("role");
  const username = localStorage.getItem("username");
  return { access, refresh, role, username };
}

export default api;
