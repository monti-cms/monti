import type { Site } from "@monti-cms/core/client";
export type EntryStatus = "draft" | "published" | "archived" | "trashed";
/** Display name of each status. */
export declare const statusLabels: (site: Pick<Site, "createTranslator">) => Record<EntryStatus, string>;
/**
 * Status text of list and edit screens. Always written as text so status is not conveyed by color alone.
 * A draft that differs from the public version is "Published · Editing".
 */
export declare function describeEntryStatus(site: Pick<Site, "createTranslator">, entry: {
    status: EntryStatus;
    hasUnpublishedChanges?: boolean;
}): string;
