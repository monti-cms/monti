import { isDeepStrictEqual } from "node:util";
/** Whether two reference lists are the same, occurrences included (a body occurrence's `blockId` is part of it). */
export function isReferencesEqual(a, b) {
    if (a.length !== b.length)
        return false;
    const key = (r) => `${r.kind}:${r.targetId.toLowerCase()}`;
    const mapA = new Map(a.map((r) => [key(r), r]));
    const mapB = new Map(b.map((r) => [key(r), r]));
    if (mapA.size !== mapB.size)
        return false;
    for (const [k, refA] of mapA.entries()) {
        const refB = mapB.get(k);
        if (!refB)
            return false;
        if (refA.isStale !== refB.isStale)
            return false;
        if (!isDeepStrictEqual(refA.occurrences, refB.occurrences))
            return false;
    }
    return true;
}
