/** An entry a relation picker shows. `title` falls back to the slug on the server, and to "Untitled" here. */
export interface RelationEntry {
    id: string;
    title: string;
    slug: string | null;
    status: string;
}
/** The picker waits this long after the last keystroke before it asks the server. */
export declare const RELATION_SEARCH_DEBOUNCE_MS = 250;
/**
 * The entries of a relation picker, searched on the server: only the entries it shows are loaded, never the whole collection.
 * `search(text)` asks for the best title matches (debounced; the empty text shows the first entries by title). The entries the field
 * already holds (`selected`) are looked up by id once, so they keep their titles whatever the search finds, and an entry the user just
 * created is added with `remember`.
 */
export declare function useRelationSearch({ collection, publishedOnly, limit, selected, enabled, }: {
    /** Collection the relation points to (or the one that holds the inverse relation). */
    collection: string;
    publishedOnly?: boolean;
    limit?: number;
    /** Ids the field holds now. Their titles are looked up even when no search result contains them. */
    selected?: readonly string[];
    enabled?: boolean;
}): {
    /** The best matches of the text typed so far. `null` until the first answer. */
    options: RelationEntry[] | null;
    /** Whether an answer for the latest text is on its way. */
    loading: boolean;
    /** Whether the last search failed. */
    error: boolean;
    /** Sets the text to search for (debounced). */
    search: import("react").Dispatch<import("react").SetStateAction<string>>;
    /** The entry with this id if it was seen, by search, lookup or `remember`. */
    entryOf: (id: string) => RelationEntry | undefined;
    /** Whether the id was looked up and no entry answered (it was deleted, trashed or belongs to another collection). */
    isMissing: (id: string) => boolean;
    /** Every entry seen so far, so a picker can name its selected values. */
    known: RelationEntry[];
    /** Shows an entry by name right away (one the user just created) and searches again. */
    remember: (entry: RelationEntry) => void;
    /** Searches the same text again. */
    reload: () => void;
};
