import { isDeepStrictEqual } from "node:util";
import type { Reference } from "../types";

/** Whether two reference lists are the same, occurrences included (a body occurrence's `blockId` is part of it). */
export function isReferencesEqual(a: readonly Reference[], b: readonly Reference[]): boolean {
	if (a.length !== b.length) return false;
	const key = (r: Reference) => `${r.kind}:${r.targetId.toLowerCase()}`;
	const mapA = new Map(a.map((r) => [key(r), r]));
	const mapB = new Map(b.map((r) => [key(r), r]));
	if (mapA.size !== mapB.size) return false;
	for (const [k, refA] of mapA.entries()) {
		const refB = mapB.get(k);
		if (!refB) return false;
		if (refA.isStale !== refB.isStale) return false;
		if (!isDeepStrictEqual(refA.occurrences, refB.occurrences)) return false;
	}
	return true;
}
