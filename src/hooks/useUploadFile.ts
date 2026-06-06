import { useMutation } from "@tanstack/react-query";
import { BlossomUploader } from "@nostrify/nostrify/uploaders";
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
        throw new Error("Must be logged in to upload files");
      }

      if (!user.signer) {
        throw new Error("Signer not found");
      }

      console.log("========== UPLOAD DEBUG ==========");
      console.log("User:", user);
      console.log("Signer:", user.signer);
      console.log("Signer methods:", Object.keys(user.signer || {}));

      const servers = options.servers || getEnabledServers();

      console.log("Upload servers:", servers);
      console.log("File:", {
        name: file.name,
        type: file.type,
        size: file.size,
      });

      const uploader = new BlossomUploader({
        servers,
        signer: user.signer,
      });

      try {
        console.log("Starting upload...");

        const tags = await uploader.upload(file);

        console.log("Upload successful");
        console.log("Returned tags:", tags);

        return tags;
      } catch (err) {
        console.error("UPLOAD ERROR:", err);
        console.error("SERVERS:", servers);
        console.error("SIGNER:", user.signer);
        console.error("SIGNER METHODS:", Object.keys(user.signer || {}));

        if (err instanceof Error) {
          console.error("ERROR MESSAGE:", err.message);
          console.error("ERROR STACK:", err.stack);
        }

        throw err;
      }
    },
  });
}
