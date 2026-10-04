/**
 * Functions that find and handle, in the public page DOM, the code lines a body `:code-ref` points to.
 * Code lines are marked by the core code block as `.line[data-anchor~="name"]` (the `anchor` line effect).
 */
/** Code lines whose anchor is `id` (document order). Nothing is found if `id` has characters that cannot be used as an anchor. */
export declare function findAnchorLines(id: string, root?: ParentNode): HTMLElement[];
/** Whether any of the lines is currently visible in the viewport. If so, highlight in place without scrolling. */
export declare function isOnScreen(lines: readonly HTMLElement[]): boolean;
/** Highlights the lines (`data-focused`) and dims the other lines of the same code block (`pre[data-code-focus]`). Returns a function that undoes it. */
export declare function focusLines(lines: readonly HTMLElement[]): () => void;
/** Expands the lines if they are inside a collapsed area and scrolls them to the center. With the reduced-motion setting, scrolls without animation. */
export declare function revealLines(lines: readonly HTMLElement[]): void;
