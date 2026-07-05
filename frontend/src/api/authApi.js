import api from "./axios";

export async function registerUser(data) {
  const response = await api.post("/auth/register", {
    email: data.email,
    password: data.password,
  });
  return response.data;
}

export async function loginUser(data) {
  const response = await api.post("/auth/login", data);
  return response.data;
}

export async function fetchCurrentUser() {
  const response = await api.get("/auth/me");
  return response.data;
}
