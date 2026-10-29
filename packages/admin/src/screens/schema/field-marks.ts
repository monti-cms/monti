import { changeItems } from "./change-list";
import { fieldsOf, type Obj, type Rename } from "./schema-model";

/** How a field of the list differs from the saved file. */
export type FieldMark =
	| { readonly kind: "added" }
	| { readonly kind: "renamed"; readonly from: string }
	| { readonly kind: "edited" };

/** A saved field the draft no longer has: it stays in the list, struck through, until the draft is saved. */
export interface GoneField {
	readonly name: string;
	readonly label: string;
	/** The saved field before it that the draft still has (under its name in the draft); `null` when it was the first of those. */
	readonly after: string | null;
}

/**
 * What the list of a collection's fields marks: each field that is new, renamed or edited by its name in the draft, and the fields that went with the place
 * they had. It reads the same changes as the changes list, so the two always agree.
 */
export function fieldMarks(
	saved: Obj,
	draft: Obj,
	renames: readonly Rename[],
	collection: string,
): { marks: Readonly<Record<string, FieldMark>>; gone: readonly GoneField[] } {
	const marks: Record<string, FieldMark> = {};
	const gone: GoneField[] = [];
	const items = changeItems(saved, { draft, renames, removed: [] }).filter(
		(item) => item.collection === collection && item.subject.kind === "field",
	);
	const savedFields = Object.keys(fieldsOf((saved.collections as Record<string, Obj> | undefined)?.[collection] ?? {}));
	const draftFields = fieldsOf((draft.collections as Record<string, Obj> | undefined)?.[collection] ?? {});
	const renamedTo = new Map(
		renames.flatMap((item) => (item.kind === "field" && item.collection === collection ? [[item.from, item.to]] : [])),
	);
	const nameInDraft = (name: string): string | null => {
		const renamed = renamedTo.get(name);
		if (renamed !== undefined && renamed in draftFields) return renamed;
		return name in draftFields ? name : null;
	};
	for (const item of items) {
		if (item.subject.kind !== "field") continue;
		const { name, label, from } = item.subject;
		if (item.tag === "added") marks[name] = { kind: "added" };
		else if (item.tag === "renamed" && from !== undefined) marks[name] = { kind: "renamed", from };
		else if (item.tag === "edited") marks[name] = { kind: "edited" };
		else if (item.tag === "removed") {
			const before = savedFields.slice(0, savedFields.indexOf(name)).reverse();
			gone.push({ name, label, after: before.map(nameInDraft).find((found) => found !== null) ?? null });
		}
	}
	return { marks, gone };
}
