import GithubSlugger from "github-slugger";
const isAsciiAlphanumeric = (code) => (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
/**
 * Percent-encodes what is not safe in a URL, leaving valid `%xx` escapes as they are. The footnote anchors of existing pages were made with this function
 * (the one of the micromark ecosystem), so it is kept as it is for them to keep working.
 */
const normalizeUri = (value) => {
    const result = [];
    let start = 0;
    let skip = 0;
    for (let index = 0; index < value.length; index++) {
        const code = value.charCodeAt(index);
        let replace = "";
        if (code === 37 &&
            isAsciiAlphanumeric(value.charCodeAt(index + 1)) &&
            isAsciiAlphanumeric(value.charCodeAt(index + 2))) {
            // A correct percent-encoded value.
            skip = 2;
        }
        else if (code < 128) {
            if (!/[!#$&-;=?-Z_a-z~]/.test(String.fromCharCode(code)))
                replace = String.fromCharCode(code);
        }
        else if (code > 55295 && code < 57344) {
            const next = value.charCodeAt(index + 1);
            if (code < 56320 && next > 56319 && next < 57344) {
                // A correct surrogate pair.
                replace = String.fromCharCode(code, next);
                skip = 1;
            }
            else {
                replace = "\uFFFD";
            }
        }
        else {
            replace = String.fromCharCode(code);
        }
        if (replace) {
            result.push(value.slice(start, index), encodeURIComponent(replace));
            start = index + skip + 1;
            replace = "";
        }
        if (skip) {
            index += skip;
            skip = 0;
        }
    }
    return result.join("") + value.slice(start);
};
/**
 * The part of rendering that needs the whole document and no React: heading anchors, the table of contents and footnote numbers.
 * Anchors and footnotes follow what the MDX chain produced (`rehype-slug`, `remark-gfm`), so links into existing pages keep working.
 */
export const DEFAULT_TOC_RANGE = { min: 2, max: 3 };
const CLOBBER_PREFIX = "user-content-";
/** How a footnote label is compared: whitespace collapsed, trimmed, case folded (as micromark reads a label). */
export const footnoteIdentifier = (label) => label.trim().replace(/\s+/g, " ").toUpperCase().toLowerCase();
/** The level of a heading node (an integer from 1 to 6), or `undefined` for a malformed one. */
export const headingLevel = (node) => {
    const level = node.attrs?.level;
    return typeof level === "number" && Number.isInteger(level) && level >= 1 && level <= 6
        ? level
        : undefined;
};
const collectDefinitions = (nodes, into) => {
    for (const node of nodes) {
        if (node.type === "footnoteDefinition" && typeof node.attrs?.label === "string") {
            // The first definition of a label wins.
            const key = footnoteIdentifier(node.attrs.label);
            if (!into.has(key))
                into.set(key, node);
        }
        if (node.content)
            collectDefinitions(node.content, into);
    }
};
export const analyzeDocument = (doc) => {
    const definitions = new Map();
    collectDefinitions(doc.content, definitions);
    const slugger = new GithubSlugger();
    const slugs = new Map();
    const headings = [];
    const refs = new Map();
    const entries = new Map();
    const order = [];
    const reference = (node) => {
        const label = node.attrs?.label;
        if (typeof label !== "string")
            return;
        const identifier = footnoteIdentifier(label);
        const definition = definitions.get(identifier);
        if (!definition)
            return;
        let entry = entries.get(identifier);
        if (!entry) {
            const safeId = normalizeUri(identifier.toUpperCase().toLowerCase());
            entry = {
                identifier,
                label: String(definition.attrs?.label ?? label),
                index: order.length + 1,
                definition,
                id: `${CLOBBER_PREFIX}fn-${safeId}`,
                refIds: [],
            };
            entries.set(identifier, entry);
            order.push(entry);
        }
        const count = entry.refIds.length + 1;
        const refId = `${entry.id.replace(`${CLOBBER_PREFIX}fn-`, `${CLOBBER_PREFIX}fnref-`)}${count > 1 ? `-${count}` : ""}`;
        entry.refIds.push(refId);
        refs.set(node, { entry, count, refId });
    };
    const textOf = (nodes) => (nodes ?? [])
        .map((node) => {
        if (node.type === "text")
            return node.text ?? "";
        if (node.type === "footnoteReference") {
            const found = refs.get(node);
            return found ? String(found.entry.index) : `[^${String(node.attrs?.label ?? "")}]`;
        }
        return textOf(node.content);
    })
        .join("");
    const walk = (node) => {
        if (node.type === "footnoteDefinition")
            return;
        if (node.type === "footnoteReference") {
            reference(node);
            return;
        }
        for (const child of node.content ?? [])
            walk(child);
        if (node.type !== "heading")
            return;
        const level = headingLevel(node);
        if (level === undefined)
            return;
        const value = textOf(node.content);
        const id = slugger.slug(value);
        slugs.set(node, id);
        headings.push({ node, value, id, href: `#${id}`, level, depth: level });
    };
    for (const node of doc.content)
        walk(node);
    // The definitions come after the body, in order of first reference; a reference inside one can add a footnote to the end of the list.
    for (let index = 0; index < order.length; index += 1) {
        for (const child of order[index]?.definition.content ?? [])
            walk(child);
    }
    return { slugs, headings, refs, footnotes: order };
};
/** The headings of the levels in `range`, with `depth` counted from the first level (`0` for an `h2` in the default range). */
export const tocOf = (analysis, range = DEFAULT_TOC_RANGE) => analysis.headings
    .filter((heading) => heading.level >= range.min && heading.level <= range.max)
    .map(({ value, id, href, level }) => ({ value, id, href, level, depth: level - range.min }));
