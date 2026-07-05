import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deleteFile, fetchFile, fetchFiles, uploadFile } from "../api/fileApi";

export function useFiles() {
  return useQuery({
    queryKey: ["files"],
    queryFn: fetchFiles,
  });
}

export function useFile(fileId) {
  return useQuery({
    queryKey: ["file", fileId],
    queryFn: () => fetchFile(fileId),
    enabled: Boolean(fileId),
  });
}

export function useDeleteFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });
}

export function useUploadFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, onUploadProgress }) => uploadFile(file, onUploadProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });
}
