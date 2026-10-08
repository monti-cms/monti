import { withoutBlockIds } from "../../doc/block-ids.js";
import { UNPARSED_NODE } from "../../doc/stored-document.js";
import { perSite } from "../../site/per-site.js";
const tablesOf = perSite((site) => {
    const { BLOCK_BY_NAME, FENCE_BLOCKS } = site;
    /** Names of expandable boxes: the box itself is a skeleton and each inner block is a unit. */
    const EXPANDED = new Set([...BLOCK_BY_NAME.values()].filter((block) => block.translateInside).map((b) => b.name));
    const translatableOf = (name) => {
        const block = BLOCK_BY_NAME.get(name);
        return Object.entries(block?.attributes ?? {}).find(([, attribute]) => attribute.translatable)?.[0];
    };
    /** Boxes that gather the child blocks' translatable attributes (e.g. tab names) into one header line. Block name → [child block name, attribute]. */
    const CHILD_HEADERS = new Map([...BLOCK_BY_NAME.values()].flatMap((block) => {
        const child = BLOCK_BY_NAME.get(block.children?.blocks?.[0] ?? "");
        const attribute = child && translatableOf(child.name);
        return child && attribute ? [[block.name, [child.name, attribute]]] : [];
    }));
    /** Blocks a human must check even without text (comments and labels may be inside). Code blocks (fence blocks such as a diagram are code blocks too). */
    const ALWAYS_MANUAL = new Set(["codeBlock", "math", ...[...FENCE_BLOCKS.values()].map((block) => block.name)]);
    return { BLOCK_BY_NAME, EXPANDED, translatableOf, CHILD_HEADERS, ALWAYS_MANUAL };
});
/** Blocks with no text to translate, so the source is used as is. */
const STRUCTURAL = new Set(["horizontalRule", "html", "mdxEsm", "mdxExpression"]);
const textOf = (node) => (node.text ?? "") + (node.content ?? []).map(textOf).join("") + attrText(node);
const attrText = (node) => {
    if (node.type !== "image")
        return "";
    return [node.attrs?.alt, node.attrs?.title].filter((value) => typeof value === "string").join("");
};
const isAuto = (site, node) => {
    if (STRUCTURAL.has(node.type))
        return true;
    if (tablesOf(site).ALWAYS_MANUAL.has(node.type)) {
        const value = node.attrs?.code ?? node.attrs?.value;
        return typeof value === "string" ? value.trim().length === 0 : false;
    }
    return textOf(node).trim().length === 0;
};
const blockSource = (node) => JSON.stringify(withoutBlockIds([node])[0]);
const stringAttr = (node, name) => {
    const value = node.attrs?.[name];
    return typeof value === "string" ? value : "";
};
const headerValue = (site, node) => {
    const { BLOCK_BY_NAME, CHILD_HEADERS, translatableOf } = tablesOf(site);
    const fromChildren = CHILD_HEADERS.get(node.type);
    if (fromChildren) {
        const [childType, attribute] = fromChildren;
        const labels = (node.content ?? [])
            .filter((child) => child.type === childType)
            .map((child) => stringAttr(child, attribute));
        return labels.some((label) => label.trim()) ? { labels } : null;
    }
    // A child that the parent gathers and translates (one tab) gets no header line of its own.
    if (BLOCK_BY_NAME.get(node.type)?.parent)
        return null;
    const attribute = translatableOf(node.type);
    if (!attribute)
        return null;
    const title = stringAttr(node, attribute);
    return title.trim() ? { title } : null;
};
/** Splits a source document into translation units (document order). */
export function flattenUnits(site, doc) {
    const { EXPANDED } = tablesOf(site);
    const units = [];
    const walk = (nodes, scope, parentId) => {
        for (const node of nodes) {
            if (EXPANDED.has(node.type)) {
                const header = headerValue(site, node);
                if (header) {
                    units.push({
                        key: `${scope}|header|${node.type}`,
                        kind: "header",
                        type: node.type,
                        node,
                        source: JSON.stringify(header),
                        parentId,
                        auto: false,
                    });
                }
                walk(node.content ?? [], `${scope}/${node.type}`, node.id);
                continue;
            }
            units.push({
                key: `${scope}|block|${node.type}`,
                kind: "block",
                type: node.type,
                node,
                source: blockSource(node),
                parentId,
                auto: isAuto(site, node),
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
/**
 * Pairs units by kind and content only (no ids). Equal blocks are omitted; a block whose content alone changed at the same position (a pair with the same key) is
 * `changed`, a new block is `added`, and a removed block is `removed`. `onEqual` is called with each pair of equal blocks.
 */
const diffUnits = (before, after, onEqual) => {
    const changes = [];
    const common = commonPairs(before, after);
    for (const [bi, ai] of common)
        onEqual?.(before[bi], after[ai]);
    const anchors = [...common, [before.length, after.length]];
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
};
/** Positions in `values` of one longest strictly increasing subsequence. */
const longestIncreasing = (values) => {
    /** For each length, the position of the smallest value that ends an increasing subsequence of that length. */
    const tails = [];
    const previous = new Array(values.length).fill(-1);
    values.forEach((value, position) => {
        let low = 0;
        let high = tails.length;
        while (low < high) {
            const mid = (low + high) >> 1;
            if (values[tails[mid]] < value)
                low = mid + 1;
            else
                high = mid;
        }
        previous[position] = low > 0 ? tails[low - 1] : -1;
        tails[low] = position;
    });
    const kept = new Set();
    for (let position = tails.length > 0 ? tails[tails.length - 1] : -1; position >= 0;) {
        kept.add(position);
        position = previous[position];
    }
    return kept;
};
/**
 * Pairs units by block id (`node.id`, the id of the box for a header unit), then pairs the units left without a partner by kind and content (`diffUnits`),
 * each stretch between two blocks that kept their place on its own.
 * A pair is unchanged (omitted) when its source is equal, otherwise `changed`. A pair is `moved` when it is not on the longest increasing subsequence of the
 * pairs' positions (in document order of the units, boxes expanded), so only as many blocks are reported as moved as needed to explain the new order, or when the
 * block now sits in another box. Pairs found by content only (no id) are never `moved`.
 */
const diffById = (before, after) => {
    const beforeById = new Map();
    before.forEach((unit, index) => {
        const id = unit.node.id;
        if (id !== undefined && !beforeById.has(id))
            beforeById.set(id, index);
    });
    // Position in `before` of the id partner of each unit of `after` (-1: none).
    const partnerOf = new Array(after.length).fill(-1);
    const taken = new Set();
    after.forEach((unit, index) => {
        const id = unit.node.id;
        const found = id === undefined ? undefined : beforeById.get(id);
        if (found === undefined || taken.has(found))
            return;
        taken.add(found);
        partnerOf[index] = found;
    });
    const own = new Array(after.length);
    // Pairs in the order of `before`: [before position, after position].
    const pairs = partnerOf
        .flatMap((found, index) => (found === -1 ? [] : [[found, index]]))
        .sort((left, right) => left[0] - right[0]);
    const inOrder = longestIncreasing(pairs.map(([, index]) => index));
    pairs.forEach(([found, index], rank) => {
        const old = before[found];
        const next = after[index];
        const edited = old.source !== next.source;
        if (!inOrder.has(rank) || old.parentId !== next.parentId) {
            own[index] = { kind: "moved", before: old, after: next, edited };
        }
        else if (edited) {
            own[index] = { kind: "changed", before: old, after: next };
        }
    });
    // Units without an id partner: by kind and content, within the stretches between blocks that kept their place.
    const beforeIndex = new Map(before.map((unit, index) => [unit, index]));
    const afterIndex = new Map(after.map((unit, index) => [unit, index]));
    const stable = [
        [-1, -1],
        ...pairs.filter((_, rank) => inOrder.has(rank)),
        [before.length, after.length],
    ];
    // Position in `after` of the partner of each unit of `before` (-1: none).
    const partnerOfBefore = new Array(before.length).fill(-1);
    for (const [found, index] of pairs)
        partnerOfBefore[found] = index;
    const removed = new Map();
    const equal = (old, next) => {
        partnerOfBefore[beforeIndex.get(old)] = afterIndex.get(next);
    };
    for (let at = 0; at + 1 < stable.length; at += 1) {
        const [fromBefore, fromAfter] = stable[at];
        const [toBefore, toAfter] = stable[at + 1];
        const restBefore = before.filter((_, index) => index > fromBefore && index < toBefore && !taken.has(index));
        const restAfter = after.filter((_, index) => index > fromAfter && index < toAfter && partnerOf[index] === -1);
        for (const change of diffUnits(restBefore, restAfter, equal)) {
            if (change.kind === "removed") {
                removed.set(beforeIndex.get(change.before), change);
                continue;
            }
            const index = afterIndex.get(change.after);
            own[index] = change;
            if (change.kind === "changed")
                partnerOfBefore[beforeIndex.get(change.before)] = index;
        }
    }
    // A removed block is listed after the closest block before it that has a partner (at that partner's new position), or first.
    const trailing = new Map();
    let anchor = -1;
    for (let index = 0; index < before.length; index += 1) {
        const partner = partnerOfBefore[index];
        if (partner !== -1)
            anchor = partner;
        const gone = removed.get(index);
        if (gone)
            trailing.set(anchor, [...(trailing.get(anchor) ?? []), gone]);
    }
    const changes = [...(trailing.get(-1) ?? [])];
    for (let index = 0; index < after.length; index += 1) {
        const change = own[index];
        if (change)
            changes.push(change);
        changes.push(...(trailing.get(index) ?? []));
    }
    return changes;
};
/**
 * Compares two source versions block by block. Equal blocks are omitted; a block whose content alone changed is `changed`, a new block is `added`, and a removed
 * block is `removed`. Blocks are paired by block id, which also finds `moved` blocks (see `diffById`). `null` if either is not a document (an `unparsed` body).
 */
export function diffSources(site, before, after) {
    const unparsed = (doc) => doc.content.some((node) => node.type === UNPARSED_NODE);
    if (unparsed(before) || unparsed(after))
        return null;
    return diffById(flattenUnits(site, before), flattenUnits(site, after));
}
