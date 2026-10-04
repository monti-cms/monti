import { BLOCK_BY_COMPONENT, BLOCK_BY_NAME, FENCE_BLOCKS } from "../../blocks/derive.js";
import { analyze, serialize, toDocument } from "../../mdx/index.js";
/**
 * Block comparison of two source versions (translation screen).
 *
 * Splits the source the translator last confirmed and the current source into blocks and finds changed, added and removed blocks.
 * Expandable boxes (`translateInside` in the block definition, e.g. callout, tabs, alignment) are expanded and their header line (translatable attributes) and inner blocks are each
 * compared. Used by both server and browser.
 */
/** Renderer names of expandable boxes: the box itself is a skeleton and each inner block is a unit. */
const EXPANDED = new Set([...BLOCK_BY_COMPONENT.values()].filter((block) => block.translateInside).map((b) => b.component));
const translatableOf = (component) => {
    const block = BLOCK_BY_COMPONENT.get(component);
    return Object.entries(block?.attributes ?? {}).find(([, attribute]) => attribute.translatable)?.[0];
};
/** Boxes that gather the child blocks' translatable attributes (e.g. tab names) into one header line. Renderer name → [child renderer name, attribute]. */
const CHILD_HEADERS = new Map([...BLOCK_BY_COMPONENT.values()].flatMap((block) => {
    const child = BLOCK_BY_NAME.get(block.children?.blocks?.[0] ?? "");
    const attribute = child && translatableOf(child.component);
    return child && attribute ? [[block.component, [child.component, attribute]]] : [];
}));
/** Blocks with no text to translate, so the source is used as is. */
const STRUCTURAL = new Set(["horizontalRule", "html", "mdxEsm", "mdxExpression"]);
/** Blocks a human must check even without text (comments and labels may be inside). Code fence blocks too. */
const ALWAYS_MANUAL = new Set([
    "codeBlock",
    "math",
    "CodeBlock",
    "Math",
    ...[...FENCE_BLOCKS.values()].map((block) => block.component),
]);
const textOf = (node) => (node.text ?? "") + (node.content ?? []).map(textOf).join("") + attrText(node);
const attrText = (node) => {
    if (node.type !== "image")
        return "";
    return [node.attrs?.alt, node.attrs?.title].filter((value) => typeof value === "string").join("");
};
const isAuto = (node) => {
    if (STRUCTURAL.has(node.type))
        return true;
    if (ALWAYS_MANUAL.has(node.type)) {
        const value = node.attrs?.value;
        return typeof value === "string" ? value.trim().length === 0 : false;
    }
    return textOf(node).trim().length === 0;
};
const blockSource = (node) => serialize({ type: "doc", content: [node] }).trimEnd();
const stringAttr = (node, name) => {
    const value = node.attrs?.[name];
    return typeof value === "string" ? value : "";
};
const headerValue = (node) => {
    const fromChildren = CHILD_HEADERS.get(node.type);
    if (fromChildren) {
        const [childType, attribute] = fromChildren;
        const labels = (node.content ?? [])
            .filter((child) => child.type === childType)
            .map((child) => stringAttr(child, attribute));
        return labels.some((label) => label.trim()) ? { labels } : null;
    }
    // A child that the parent gathers and translates (one tab) gets no header line of its own.
    if (BLOCK_BY_COMPONENT.get(node.type)?.parent)
        return null;
    const attribute = translatableOf(node.type);
    if (!attribute)
        return null;
    const title = stringAttr(node, attribute);
    return title.trim() ? { title } : null;
};
/** Splits a source document into translation units (document order). */
export function flattenUnits(doc) {
    const units = [];
    const walk = (nodes, scope) => {
        for (const node of nodes) {
            if (EXPANDED.has(node.type)) {
                const header = headerValue(node);
                if (header) {
                    units.push({
                        key: `${scope}|header|${node.type}`,
                        kind: "header",
                        type: node.type,
                        node,
                        source: JSON.stringify(header),
                        auto: false,
                    });
                }
                walk(node.content ?? [], `${scope}/${node.type}`);
                continue;
            }
            units.push({
                key: `${scope}|block|${node.type}`,
                kind: "block",
                type: node.type,
                node,
                source: blockSource(node),
                auto: isAuto(node),
            });
        }
    };
    walk(doc.content ?? [], "");
    return units;
}
/** Longest common subsequence of two lists (pairs whose key and source fragment are both equal). A list of [before index, after index]. */
const commonPairs = (before, after) => {
    const same = (i, j) => before[i]?.key === after[j]?.key && before[i]?.source === after[j]?.source;
    const cols = after.length + 1;
    const table = new Array((before.length + 1) * cols).fill(0);
    for (let i = before.length - 1; i >= 0; i -= 1) {
        for (let j = after.length - 1; j >= 0; j -= 1) {
            table[i * cols + j] = same(i, j)
                ? (table[(i + 1) * cols + j + 1] ?? 0) + 1
                : Math.max(table[(i + 1) * cols + j] ?? 0, table[i * cols + j + 1] ?? 0);
        }
    }
    const pairs = [];
    let i = 0;
    let j = 0;
    while (i < before.length && j < after.length) {
        if (same(i, j)) {
            pairs.push([i, j]);
            i += 1;
            j += 1;
        }
        else if ((table[(i + 1) * cols + j] ?? 0) >= (table[i * cols + j + 1] ?? 0))
            i += 1;
        else
            j += 1;
    }
    return pairs;
};
const unitsOf = (mdx) => {
    const analysis = analyze(mdx);
    return analysis.errors.length > 0 ? null : flattenUnits(toDocument(analysis));
};
/**
 * Compares two source versions block by block. Equal blocks are omitted; a block whose content alone changed at the same position (a pair with the same key) is
 * `changed`, a new block is `added`, and a removed block is `removed`. `null` if either cannot be parsed.
 */
export function diffSources(beforeMdx, afterMdx) {
    const before = unitsOf(beforeMdx);
    const after = unitsOf(afterMdx);
    if (!before || !after)
        return null;
    const changes = [];
    const anchors = [...commonPairs(before, after), [before.length, after.length]];
    let prevBefore = 0;
    let prevAfter = 0;
    for (const [bi, ai] of anchors) {
        // Segment between anchors: pairing same-key items in order gives changed blocks; leftovers are removed or added blocks.
        let b = prevBefore;
        for (let a = prevAfter; a < ai; a += 1) {
            const next = after[a];
            if (!next)
                continue;
            let found = -1;
            for (let k = b; k < bi; k += 1) {
                if (before[k]?.key === next.key) {
                    found = k;
                    break;
                }
            }
            if (found === -1) {
                changes.push({ kind: "added", after: next });
                continue;
            }
            for (let k = b; k < found; k += 1) {
                const gone = before[k];
                if (gone)
                    changes.push({ kind: "removed", before: gone });
            }
            const old = before[found];
            if (old)
                changes.push({ kind: "changed", before: old, after: next });
            b = found + 1;
        }
        for (let k = b; k < bi; k += 1) {
            const gone = before[k];
            if (gone)
                changes.push({ kind: "removed", before: gone });
        }
        prevBefore = bi + 1;
        prevAfter = ai + 1;
    }
    return changes;
}
