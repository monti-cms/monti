import { SUPPORTED_FILE_MIME_TYPES, SUPPORTED_IMAGE_MIME_TYPES, } from "../core/media-types.js";
/**
 * The store accepts every format the core can detect. The formats and sizes narrowed by the site config (`media`) are checked by the upload API.
 * The store is created by the server config (`cms.server.ts`), so it does not read the site config.
 */
export const ALLOWED_MEDIA_MIMES = [
    ...SUPPORTED_IMAGE_MIME_TYPES,
    ...SUPPORTED_FILE_MIME_TYPES,
];
