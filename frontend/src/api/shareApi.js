import api from "./axios";

export async function createShareLink(fileId, data) {
  const response = await api.post(`/shares/files/${fileId}`, data);
  return response.data;
}

export async function revokeShareLink(shareId) {
  const response = await api.post(`/shares/${shareId}/revoke`);
  return response.data;
}

export async function downloadSharedFile(token, password) {
  const response = await api.post(`/shares/${token}/download`, { password });
  return response.data;
}
