/**
 * Functions that find and handle, in the public page DOM, the code lines a body `:code-ref` points to.
 * Code lines are marked by the core code block as `.line[data-anchor~="name"]` (the `anchor` line effect).
 */
const ANCHOR_ID = /^[\w-]+$/;
/** Code lines whose anchor is `id` (document order). Nothing is found if `id` has characters that cannot be used as an anchor. */
export function findAnchorLines(id, root = document) {
    if (!ANCHOR_ID.test(id))
        return [];
    return Array.from(root.querySelectorAll(`.line[data-anchor~="${id}"]`));
}
/** Whether it is rendered (it is not when inside a closed collapsible). */
const isRendered = (element) => element.getClientRects().length > 0;
/** Whether any of the lines is currently visible in the viewport. If so, highlight in place without scrolling. */
export function isOnScreen(lines) {
    const height = window.innerHeight || document.documentElement.clientHeight;
    return lines.some((line) => {
        if (!isRendered(line))
            return false;
        const rect = line.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < height;
    });
}
/** Highlights the lines (`data-focused`) and dims the other lines of the same code block (`pre[data-code-focus]`). Returns a function that undoes it. */
export function focusLines(lines) {
    const pres = new Set();
    for (const line of lines) {
        line.setAttribute("data-focused", "");
        const pre = line.closest("pre");
        if (pre)
            pres.add(pre);
    }
    for (const pre of pres)
        pre.setAttribute("data-code-focus", "");
    return () => {
        for (const line of lines)
            line.removeAttribute("data-focused");
        for (const pre of pres)
            pre.removeAttribute("data-code-focus");
    };
}
const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
/** Expands the lines if they are inside a collapsed area and scrolls them to the center. With the reduced-motion setting, scrolls without animation. */
export function revealLines(lines) {
    const first = lines[0];
    if (!first)
        return;
    for (const line of lines) {
        for (let details = line.closest("details"); details; details = details.parentElement?.closest("details") ?? null)
            details.open = true;
    }
    first.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
}
