import { CmsError } from "../store/errors.js";
/**
 * What saving a draft with `slug` does to the reservation, given the row that holds the slug (`null` if nobody does).
 * `keep`: the entry already owns the slug (a reservation, or its own current or alias slug, which a publish promotes); `reserve`: a free slug.
 * Another entry holding it is a `slug_conflict` (409), whatever the holder's type.
 */
export function reservationFor(entryId, holder) {
    if (holder === null)
        return "reserve";
    if (holder.entryId === entryId)
        return "keep";
    throw new CmsError("Slug conflict", "slug_conflict");
}
/** Address change of a publish, from the entry's current slug and the draft's slug (`null` when it has none). */
export function planPublishAddress(currentSlug, targetSlug) {
    return {
        demoteCurrent: currentSlug !== null && currentSlug !== targetSlug,
        promote: targetSlug !== null && targetSlug !== currentSlug,
    };
}
/** After claiming the target slug, the row must be this entry's current address. Anything else is a `slug_conflict`. */
export function assertPromotedToCurrent(entryId, holder) {
    if (holder?.entryId !== entryId || holder?.type !== "current")
        throw new CmsError("Slug conflict", "slug_conflict");
}
/**
 * Whether the address of an internal link target changed between two reads (the second one holds a lock). A publish validates links against the locked read,
 * so a change in between means the validated state is stale: the publish fails with `conflict` rather than publish a dead link.
 */
export function linkTargetChanged(before, after) {
    return (before?.type ?? null) !== (after?.type ?? null) || (before?.entryId ?? null) !== (after?.entryId ?? null);
}
