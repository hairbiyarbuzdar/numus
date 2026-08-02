import { apiClient, ApiActor } from "./apiClient";

export type UploadFolder = "products" | "auctions" | "profiles" | "misc";

interface UploadResponse {
  urls: string[];
  url: string;
}

/** Reads a File into a `data:<mime>;base64,...` string for upload. */
export const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });

export const uploadApi = {
  /**
   * Uploads a file and returns its URL. The URL is what gets stored — the
   * encoded bytes are never written to the database.
   */
  async uploadFile(file: File, folder: UploadFolder = "misc", actor?: ApiActor) {
    const dataUrl = await readFileAsDataUrl(file);
    const response = await apiClient.post<UploadResponse>("/uploads", { file: dataUrl, folder }, { actor });
    return response.url;
  },

  async uploadFiles(files: File[], folder: UploadFolder = "misc", actor?: ApiActor) {
    const dataUrls = await Promise.all(files.map(readFileAsDataUrl));
    const response = await apiClient.post<UploadResponse>("/uploads", { files: dataUrls, folder }, { actor });
    return response.urls;
  },
};
