/** A stable name of a change, for a list in a screen: the same change in two diffs has the same key. */
export function changeKey(change) {
    const parts = [change.kind];
    if ("collection" in change)
        parts.push(change.collection);
    if ("field" in change)
        parts.push(change.field);
    if (change.kind === "field_renamed" || change.kind === "option_renamed")
        parts.push(change.from, change.to);
    if (change.kind === "option_added" || change.kind === "option_removed")
        parts.push(change.option);
    if (change.kind === "locale_added" || change.kind === "locale_removed")
        parts.push(change.locale);
    if (change.kind === "default_locale_changed")
        parts.push(change.from, change.to);
    return parts.filter((part) => part !== undefined).join(":");
}
