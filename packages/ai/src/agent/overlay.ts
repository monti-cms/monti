import type { ProposalItem } from "./proposals";

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** Sets the planned value of one item on an object that is its target, wherever the read put the value. */
function patch(target: Json, item: ProposalItem): void {
	const { spot } = item.target;
	const after = item.preview.after;
	if (item.target.kind === "media") {
		if (spot) target[spot] = after;
		return;
	}
	if (spot === "folder") {
		target.folderId = after;
		return;
	}
	if (spot === "trash") {
		// The read still lists it; the flag tells the model it is about to go to the trash.
		target.proposedTrash = true;
		return;
	}
	if (spot?.startsWith("body:")) {
		// A body change: the body text the read gave (`working.body`, with a format) reads with the block's new text in place.
		const working = isObject(target.working) ? target.working : undefined;
		const { before, after: next } = item.preview as { before: unknown; after: unknown };
		if (working && typeof working.body === "string" && typeof before === "string") {
			working.body =
				typeof next === "string"
					? working.body.replace(before, () => next)
					: // A removed block takes its blank line with it.
						working.body
							.replace(before, "")
							.replace(/\n{3,}/g, "\n\n")
							.trim();
		}
		return;
	}
	if (!spot) return;
	for (const holder of [target.metadata, isObject(target.working) ? target.working.metadata : undefined]) {
		if (isObject(holder)) holder[spot] = after;
	}
}

/**
 * A read result as it would look with the run's pending items applied (docs/design/agent.md §3, "reads see the proposals"): every object in it whose `id` is the
 * target of an item gets the planned value. The data in the store is untouched; this only lets the model plan the next step on top of the earlier ones.
 */
export function overlay<T>(result: T, items: readonly ProposalItem[]): T {
	if (items.length === 0) return result;
	const byId = new Map<string, ProposalItem[]>();
	for (const item of items) byId.set(item.target.id, [...(byId.get(item.target.id) ?? []), item]);
	const copy = structuredClone(result);
	const visit = (value: unknown): void => {
		if (Array.isArray(value)) {
			for (const child of value) visit(child);
			return;
		}
		if (!isObject(value)) return;
		const id = typeof value.id === "string" ? value.id : typeof value.mediaId === "string" ? value.mediaId : undefined;
		for (const item of (id && byId.get(id)) || []) patch(value, item);
		for (const child of Object.values(value)) visit(child);
	};
	visit(copy);
	return copy;
}
