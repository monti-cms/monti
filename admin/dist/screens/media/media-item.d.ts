import type { TranslatorFor } from "../../translator.js";
import type { mediaMessages } from "./messages.js";
/** One item of the media list API. */
export interface MediaItem {
    id: string;
    status: "ready" | "deleting" | "pending" | "failed";
    filename: string;
    mimeType: string | null;
    byteSize: number | null;
    width: number | null;
    height: number | null;
    publicUrl: string | null;
    original: {
        mimeType: string | null;
        byteSize: number | null;
        width: number | null;
        height: number | null;
    } | null;
    defaultAlt: string;
    defaultCaption: string;
    createdAt: string;
    referencesCount: number;
    references: {
        entryId: string;
        title: string | null;
        collection: string;
        state: "working" | "published";
    }[];
}
/** One post that uses the media. Counts previously tallied separately for the draft being edited and the published post are merged into one per post. */
export interface MediaUsage {
    entryId: string;
    title: string | null;
    collection: string;
    /** Note shown when it is used on one side only. Absent when used in both. */
    note?: "beforePublish" | "publishedOnly";
}
/**
 * Merges usages into one per post. A published post's draft and published version share the same image and are counted twice, but to a person it is one post.
 * If only in the draft (newly added, not yet published), it is labeled "before publishing"; if only in the published version (removed from the draft but still in the public post), "published only".
 */
export declare function mediaUsages(media: Pick<MediaItem, "references">): MediaUsage[];
/** Usage count. Counted once per post (the server's count when only non-post usages exist, such as templates). */
export declare const usageCount: (media: MediaItem) => number;
/** Usage state shown on lists and tiles. */
export declare const usageLabel: (t: TranslatorFor<typeof mediaMessages>, media: MediaItem) => string;
/** Text of the usage note (`note`). */
export declare const usageNoteLabel: (t: TranslatorFor<typeof mediaMessages>, note: NonNullable<MediaUsage["note"]>) => string;
export declare function copyText(t: TranslatorFor<typeof mediaMessages>, text: string, success: string): Promise<void>;
/** Appends the original file's extension to the new name (suggested names come without an extension). If it already has the same extension, leaves it as is. */
export declare function withExtension(name: string, original: string): string;
