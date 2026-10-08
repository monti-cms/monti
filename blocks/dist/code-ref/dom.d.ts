/**
 * Functions that find and handle, in the public page DOM, the code lines a body `:code-ref` points to.
 * Code lines are marked by the core code block as `.line[data-anchor~="name"]` (the `anchor` line effect).
 */
/**
 * Code lines whose anchor is `id` (document order). A label is meant to be unique per document, and a link must resolve to exactly one code block,
 * so only the lines of the first `<pre>` (in document order) that has a matching line are returned, never lines from two code blocks.
 * Nothing is found if `id` has characters that cannot be used as an anchor.
 */
export declare function findAnchorLines(id: string, root?: ParentNode): HTMLElement[];
/** The body text elements (`[data-code-ref]`) that point to `id` (document order). Nothing is found for an id that cannot be an anchor. */
export declare function findRefTexts(id: string, root?: ParentNode): HTMLElement[];
/** Whether any of the lines is currently visible in the viewport. If so, highlight in place without scrolling. */
export declare function isOnScreen(lines: readonly HTMLElement[]): boolean;
/** Highlights the lines (`data-focused`) and dims the other lines of the same code block (`pre[data-code-focus]`). Returns a function that undoes it. */
export declare function focusLines(lines: readonly HTMLElement[]): () => void;
/**
 * Event a reveal dispatches on its target before scrolling (it bubbles). A block that hides content (a tab, a file of the code explorer)
 * listens for it, shows the part that holds `event.target` synchronously, and so makes the target visible before the scroll.
 */
export declare const REVEAL_EVENT = "cms:reveal";
/**
 * Expands the lines if they are inside a collapsed area, asks the blocks that hide them to show them (`cms:reveal`), and scrolls them to the center.
 * With the reduced-motion setting, scrolls without animation.
 */
export declare function revealLines(lines: readonly HTMLElement[]): void;
/** Preview of linked code lines: the code block title (if any), the text of each line, and whether the list was cut short. */
export interface CodePreview {
    readonly title?: string;
    readonly lines: readonly string[];
    readonly truncated: boolean;
}
/** Text of the linked lines (at most `max`, the rest is reported by `truncated`) and the title of their code block (`.cms-code-title`). */
export declare function previewLines(lines: readonly HTMLElement[], max: number): CodePreview;
/**
 * Adds a small back-link button at the end of the first line of the linked lines (code to text). Does nothing if the line already has one,
 * so only one `CodeRef` per label adds it. Returns a function that removes the button.
 */
export declare function addBackLink(lines: readonly HTMLElement[], onClick: () => void, label: string): () => void;
/** Highlights the element (`data-focused`) and removes the highlight after `ms`. Pressing again restarts the timer. */
export declare function flashElement(element: HTMLElement, ms: number): void;
/** Scrolls the first body text that points to `id` to the center (expanding collapsed areas, `cms:reveal`) and highlights it briefly. */
export declare function revealRefText(id: string, ms: number, root?: ParentNode): void;
