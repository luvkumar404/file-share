import api from "./axios";

export async function fetchFiles() {
  const response = await api.get("/files");
  return response.data;
}

export async function fetchFile(fileId) {
  const response = await api.get(`/files/${fileId}`);
  return response.data;
}

export async function uploadFile(file, onUploadProgress) {
  const formData = new FormData();
  formData.append("upload", file);

  const response = await api.post("/files", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress,
  });
  return response.data;
}

export async function deleteFile(fileId) {
  await api.delete(`/files/${fileId}`);
}
