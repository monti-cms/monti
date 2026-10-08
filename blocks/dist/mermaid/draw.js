/**
 * Draws a diagram without leaving mermaid's own error graphic ("Syntax error in text") in the page. The source is parsed first, which throws the
 * syntax error without touching the document, and a render that still fails has its leftover elements (`#<id>` and `#d<id>`, which mermaid appends
 * to `document.body`) removed. The caller shows its own error text.
 */
export async function drawMermaid(mermaid, id, source) {
    await mermaid.parse(source);
    try {
        return (await mermaid.render(id, source)).svg;
    }
    finally {
        // On success mermaid removes its scratch element itself; on failure it leaves it (with the bomb) behind.
        for (const leftover of [`d${id}`, id])
            document.getElementById(leftover)?.remove();
    }
}
