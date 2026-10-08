/** The kinds, for the stores and for tests. */
export const CONTENT_CHANGE_KINDS = [
    "created",
    "saved",
    "published",
    "archived",
    "unarchived",
    "trashed",
    "restored",
    "deleted",
];
/** Throw it from a subscriber to defer the delivery (see {@link DeferredDelivery}). */
export class DeferDelivery extends Error {
    retryAt;
    constructor(retryAt, message = "Delivery deferred") {
        super(message);
        this.name = "DeferDelivery";
        this.retryAt = retryAt;
    }
}
export const isDeferred = (value) => typeof value === "object" && value !== null && value.retryAt instanceof Date;
/** The event of a change on an entry, built from the entry as the change leaves it. Stores use it to write the row. */
export function eventRowOf(kind, entry) {
    return {
        kind,
        entryId: entry.id,
        collection: entry.collection,
        locale: entry.locale,
        version: entry.version,
        contentHash: (kind === "published" ? (entry.published ?? entry.working) : entry.working).contentHash,
        payload: {
            translationGroupId: entry.translationGroupId,
            status: entry.status,
            publishedSlug: entry.publishedSlug,
            workingSlug: entry.workingSlug,
        },
    };
}
