/**
 * Writes the schema file back as text with as little change as possible, so a change made in the admin shows up in a code review as that change and nothing
 * else. The previous text is parsed with positions; every part of the new content that equals the same place of the old content is copied from the old text
 * as it was written (hand-formatted arrays, spacing, long lines), and only what changed is written fresh, in the file's own indentation. Keys keep the order
 * of the new content, which is the old order for everything that was not moved. A trailing newline (or none) is kept.
 */
/** The indentation unit of a text: a tab, or the spaces of the first indented line. A tab if the text has none. */
export declare function indentOf(text: string): string;
/**
 * The text of a schema file for `next`, written over `previous` (the text it replaces; pass `undefined` for a new file). With `previous` the unchanged parts keep
 * their text; the rest is written with the indentation of `previous`.
 */
export declare function formatSchemaText(previous: string | undefined, next: unknown): string;
