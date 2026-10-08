/** The root layout of the App Router (relative to `cwd`, with `/`), or `undefined` when there is none. */
export declare function findRootLayout(cwd: string): string | undefined;
/** Whether the `<html>` tag of a layout has `suppressHydrationWarning` (set, not `={false}`); `undefined` when the text has no `<html>` tag (a nested layout). */
export declare function hasSuppressHydrationWarning(text: string): boolean | undefined;
