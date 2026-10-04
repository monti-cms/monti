import { type SaveDraftInput, type ServiceInput, type StorePort } from "./types.js";
export { imageWarningsForPublish, prepareSnapshot, validateForPublish } from "../core/snapshot.js";
export declare const createContentService: <T = unknown>(storePort: StorePort<T>) => {
    /**
     * Creates new content. A record collection is published right away by default (when `publishImmediately` is omitted).
     */
    createDraft: (input: ServiceInput, options?: {
        publishImmediately?: boolean;
    }) => Promise<T>;
    /**
     * Saves the latest draft. A record collection by default applies to the public value together with the save.
     */
    saveDraft: (entryId: string, input: SaveDraftInput, options?: {
        publishImmediately?: boolean;
    }) => Promise<T>;
    /**
     * Creates a translation. A draft whose structure follows the latest draft of the source (the source of the group), with the source text placed as translation notes.
     * The address reuses the source address (languages differ, so they do not collide). The folder is the same as the source.
     * If called on a translation, it is created from that group's source.
     */
    createTranslation: (params: {
        sourceId: string;
        locale: string;
    }) => Promise<T>;
};
