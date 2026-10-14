import type { MediaUrlResolver } from "../core/import-normalize.js";
import { type ImageWarningResolvers } from "../core/snapshot.js";
import type { Entry } from "../core/store/index.js";
import type { FormatRegistry } from "../format/registry.js";
import type { Site } from "../site/index.js";
import type { HookProvider } from "./hooks.js";
import { type Issue, type RestorePort, type SaveDraftInput, type ServiceInput, type StorePort } from "./types.js";
import { type WritePipeline } from "./write-pipeline.js";
export { imageWarningsForSnapshot, prepareSnapshot, validateForPublish } from "../core/snapshot.js";
export interface ContentServiceOptions {
    /** The site the writes are for. */
    readonly site: Site;
    /** Hooks of the server config and the plugins. Without it, writes run core preparation only. */
    readonly hooks?: HookProvider;
    /** The formats a body given as text can be in. Without it, only the built-in ones. */
    readonly formats?: () => Promise<FormatRegistry>;
    /** Looks up the registered media files the image URLs of an imported body point to. Without it, image URLs are kept as written. */
    readonly media?: MediaUrlResolver;
    /** Looks up the media rows and stored files behind the images of a body, for the image warnings of a publish. Without it, a publish reports no image warnings. */
    readonly imageChecks?: ImageWarningResolvers;
    /** A pipeline shared with other services (bulk). Takes the place of `hooks`, `formats` and `media`. */
    readonly pipeline?: WritePipeline;
}
/**
 * What every write of the content service returns (create, save, translate, duplicate, publish, restore): the entry as it is now, and the warnings the
 * write found (core's, the blocks' and the hooks'). The warnings never block and are never part of the entry; the list is empty when there are none.
 */
export interface WriteResult {
    readonly entry: Entry;
    readonly warnings: readonly Issue[];
}
/**
 * Content writes. Each builds its input and sends it through the one write pipeline (`write-pipeline.ts`) before the store commits it.
 * The store never prepares content itself.
 */
export declare const createContentService: (storePort: StorePort & Partial<RestorePort>, options: ContentServiceOptions) => {
    /**
     * Creates new content. A record collection is published right away by default (when `publishImmediately` is omitted).
     */
    createDraft: (input: ServiceInput, options?: {
        publishImmediately?: boolean;
    }) => Promise<WriteResult>;
    /**
     * Saves the latest draft. A record collection by default applies to the public value together with the save.
     */
    saveDraft: (entryId: string, input: SaveDraftInput, options?: {
        publishImmediately?: boolean;
    }) => Promise<WriteResult>;
    /**
     * Creates a translation. A draft whose structure follows the latest draft of the source (the source of the group), with the source text placed as translation notes.
     * The address reuses the source address (languages differ, so they do not collide). The folder is the same as the source.
     * If called on a translation, it is created from that group's source.
     */
    createTranslation: (params: {
        sourceId: string;
        locale: string;
    }) => Promise<WriteResult>;
    /**
     * Duplicates the latest draft as a new draft: same body and fields, in the original's locale and folder. Slug, publish status and the
     * published version are not copied. `title` replaces the copy's title; any suffix (such as "(copy)") is up to the caller.
     * A record or a translation cannot be duplicated (translate the source instead).
     */
    duplicate: (params: {
        id: string;
        title?: string;
    }) => Promise<WriteResult>;
    /**
     * Publishes the latest saved draft. The draft goes through the write pipeline first (a hook that changed it has the change saved with the
     * publish, in one transaction), then the store checks the prepared draft against the rows it has to lock and commits.
     * The result's warnings include the image notices of the prepared draft (when the service has `imageChecks`), which never block.
     * Single and bulk publishes both come through here, so they report the same.
     */
    publish: (params: {
        id: string;
        expectedVersion: number;
        resetPublishedAt?: boolean;
        publishedAt?: Date;
    }) => Promise<WriteResult>;
    /**
     * Trash to restore. A record is published again, so its draft goes through the write pipeline first as a `restore`: `validate` and
     * `validatePublish` hooks run (a restriction on publishing cannot be bypassed by trash and restore), `transform` hooks do not (the content
     * is unchanged). Other collections return to draft and are not published, so nothing runs for them.
     */
    restore: (params: {
        id: string;
        expectedVersion: number;
    }) => Promise<WriteResult>;
};
