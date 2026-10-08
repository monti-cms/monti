import type { MediaUrlResolver } from "../core/import-normalize.js";
import type { ContentStore } from "../core/store/index.js";
import type { MediaStore } from "../media/store.js";
/**
 * Finds the registered media file a public URL belongs to. A public URL is the media store's base followed by the storage key, so the key is what follows
 * the base; the file is the ready one stored under it. A URL outside the store, or one no ready file holds, is not in the result.
 */
export declare const mediaUrlResolver: (store: () => Pick<ContentStore, "findReadyMediaByStorageKeys">, mediaStore: () => MediaStore) => MediaUrlResolver;
