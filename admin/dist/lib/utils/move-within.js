/**
 * A copy of `list` with the item at `from` moved to index `to` (the index it has afterwards). `to` is kept inside the list; an unknown `from`, or a move
 * to where the item already is, gives an unchanged copy. The one move every ordered list of the admin (fields, options, locales, tabs, blocks, relations) uses.
 */
export function moveWithin(list, from, to) {
    const next = [...list];
    const target = Math.min(next.length - 1, Math.max(0, to));
    if (from < 0 || from >= next.length || from === target)
        return next;
    const [moved] = next.splice(from, 1);
    next.splice(target, 0, moved);
    return next;
}
