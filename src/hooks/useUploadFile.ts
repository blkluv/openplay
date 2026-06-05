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

+     // Check that the signer is ready and has the required methods
+     if (!user.signer || typeof user.signer.signEvent !== 'function') {
+       throw new Error('Signer not ready. Please unlock your extension or reload.');
+     }

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
