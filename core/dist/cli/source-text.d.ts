/**
 * Reading JavaScript and TypeScript source as text, just enough for the edits `monti init` makes and the checks `monti doctor` runs on files the app owns: skipping strings,
 * template literals and comments, matching brackets, and the code of a file without its comments and strings. It is not a parser; a file in a shape these cannot read is
 * left to the person.
 */
/** The index after the string, template literal or comment that starts at `index`; `index` itself when nothing of the kind starts there. */
export declare function skipLiteral(text: string, index: number): number;
/**
 * The code of a file with its comments and the contents of its strings blanked out, except the module names of imports (after `from` or `require(`).
 * What is left is what the program does, so a search of it is not satisfied by a comment or a string that mentions the name.
 */
export declare function codeOf(text: string): string;
/** The index of the bracket that closes the one at `open` (`(`, `[` or `{`), or `-1` when there is none. */
export declare function matchingClose(text: string, open: number): number;
