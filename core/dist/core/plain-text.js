/**
 * Readable plain text of an MDX body. Used for filling fields from the body (`fillFromBody`).
 * Code, math, images and directive syntax are dropped; only the labels of links and directives remain.
 */
export function toPlainText(mdx) {
    return (mdx
        // code fences, block math, comments
        .replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, " ")
        .replace(/^\$\$[\s\S]*?^\$\$/gm, " ")
        .replace(/\{\/\*[\s\S]*?\*\/\}|<!--[\s\S]*?-->/g, " ")
        // container directive fences and leaf directives (`::image{...}`)
        .replace(/^:{3,}[^\n]*$/gm, " ")
        .replace(/^::[a-z][\w-]*(\[[^\]]*\])?(\{[^}]*\})?\s*$/gm, " ")
        // text directive `:name[label]{...}` → label
        .replace(/:[a-z][\w-]*\[([^\]]*)\](\{[^}]*\})?/g, "$1")
        // drop images; keep only a link's label
        .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        // JSX/HTML tags
        .replace(/<\/?[A-Za-z][^>]*>/g, " ")
        // heading, quote and list markers and emphasis symbols
        .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+(\[[ xX]\]\s+)?/gm, "")
        .replace(/(\*\*|__|~~|\*|_|`)/g, "")
        .replace(/^\|?[\s:|-]+\|?$/gm, " ")
        .replace(/\|/g, " ")
        .replace(/\s+/g, " ")
        .trim());
}
/**
 * Leading plain text of the body (up to `maxLength` characters, with `…` appended if longer). Used when filling an empty field from the body (`fillFromBody`).
 * Empty string if there is no text to produce.
 */
export function bodyExcerpt(mdx, maxLength = 160) {
    const text = toPlainText(mdx);
    const chars = Array.from(text);
    if (chars.length <= maxLength)
        return text;
    return `${chars
        .slice(0, maxLength - 1)
        .join("")
        .trimEnd()}…`;
}
