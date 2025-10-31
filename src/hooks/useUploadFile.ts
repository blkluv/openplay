import { useMutation } from "@tanstack/react-query";
import { BlossomUploader } from '@nostrify/nostrify/uploaders';
import { useCurrentUser } from "./useCurrentUser";
import { useMediaServers } from "./useMediaServers";

export interface UploadFileOptions {
  servers?: string[];
}

export function useUploadFile(options: UploadFileOptions = {}) {
  const { user } = useCurrentUser();
  const { getEnabledServers } = useMediaServers();

  return useMutation({
    mutationFn: async (file: File) => {
      if (!user) {
        throw new Error('Must be logged in to upload files');
      }

      // Use provided servers, or fall back to user's configured servers
      const servers = options.servers || getEnabledServers();

      const uploader = new BlossomUploader({
        servers,
        signer: user.signer,
      });

      const tags = await uploader.upload(file);
      return tags;
    },
  });
}