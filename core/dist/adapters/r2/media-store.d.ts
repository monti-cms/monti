import { type MediaStore, type MediaStoreConfig } from "./types.js";
/** S3 API media store (R2, S3, MinIO, etc.). Uploads via presigned URLs, then the server verifies and moves the file. */
export declare function createS3MediaStore(config: MediaStoreConfig): MediaStore;
export { detectImageDimensionsAndType, type ImageDimensionsAndType } from "../../media/image-detect.js";
