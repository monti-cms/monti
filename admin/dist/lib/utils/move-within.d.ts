/**
 * A copy of `list` with the item at `from` moved to index `to` (the index it has afterwards). `to` is kept inside the list; an unknown `from`, or a move
 * to where the item already is, gives an unchanged copy. The one move every ordered list of the admin (fields, options, locales, tabs, blocks, relations) uses.
 */
export declare function moveWithin<T>(list: readonly T[], from: number, to: number): T[];
