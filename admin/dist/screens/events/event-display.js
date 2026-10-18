export const STATE_TONE = {
    delivered: "success",
    failed: "destructive",
    dead: "destructive",
    pending: "warning",
    delivering: "warning",
    dismissed: "neutral",
    recorded: "neutral",
};
/** What names the entry of an event: its title when the change was made, else its address, else the id (an entry may have no title). */
export const eventEntryLabel = (change) => change.title || change.workingSlug || change.publishedSlug || change.entryId;
