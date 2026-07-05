import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createShareLink, downloadSharedFile, revokeShareLink } from "../api/shareApi";

export function useCreateShareLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ fileId, data }) => createShareLink(fileId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });
}

export function useRevokeShareLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: revokeShareLink,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });
}

export function useDownloadSharedFile() {
  return useMutation({
    mutationFn: ({ token, password }) => downloadSharedFile(token, password),
  });
}
